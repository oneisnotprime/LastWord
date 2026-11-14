/**
 * Bot tournament: plays whole rounds of bots with no humans, headless, and prints which systems
 * the bots used, where their letters came from, and how long rounds ran.
 *
 *   npx tsx loadtest/tournament.ts [rooms=4] [bots=8] [difficulty=mixed|easy|normal|hard] [minutes=60]
 *
 * "mixed" gives each room's bots easy, normal and hard in turn. Rooms play one after another in
 * this process (the room steps by hand, ten ticks to a second, as fast as it can).
 */
import { boot } from "@colyseus/testing";
import appConfig from "../src/app.config.js";
import { sourceOf, type Difficulty } from "../src/bots.js";
import { WorldRoom } from "../src/WorldRoom.js";

const [rooms = 4, bots = 8] = process.argv.slice(2, 4).map(Number);
const mode = (process.argv[4] ?? "mixed") as Difficulty | "mixed";
const cap = Number(process.argv[5] ?? 60);

const server = await boot(appConfig);
const used = new Map<Difficulty, Map<string, number>>();
const sources = new Map<string, number>();
const rounds: { minutes: number; winner: string; difficulty: string }[] = [];
const wins = new Map<string, number>();

for (let r = 0; r < rooms; r++) {
  WorldRoom.testSeed = 1000 + r * 7919;
  const first = mode === "mixed" ? "easy" : mode;
  const room = (await server.createRoom("world", { bots: mode === "mixed" ? 0 : bots, difficulty: first })) as unknown as WorldRoom;
  if (mode === "mixed") for (let i = 0; i < bots; i++) room.addBots(1, (["easy", "normal", "hard"] as const)[i % 3]!);
  room.onAward = (_id, letters, why) => {
    if (process.env.WHY && sourceOf(why) === process.env.WHY) console.log(why);
    sources.set(sourceOf(why), (sources.get(sourceOf(why)) ?? 0) + letters.length);
  };
  let seconds = 0;
  while (room.state.phase !== "over" && seconds < cap * 60) { room.update(0.1); seconds += 0.1; }
  const report = room.botReport();
  for (const b of report) {
    const m = used.get(b.difficulty) ?? used.set(b.difficulty, new Map()).get(b.difficulty)!;
    for (const [k, n] of Object.entries(b.used)) m.set(k, (m.get(k) ?? 0) + n);
  }
  const winner = room.state.winner || "(none)";
  const level = report.find((b) => b.id === winner)?.difficulty ?? "-";
  wins.set(level, (wins.get(level) ?? 0) + 1);
  rounds.push({ minutes: +(seconds / 60).toFixed(1), winner, difficulty: level });
  console.log(`room ${r + 1}: ${winner} (${level}) won after ${(seconds / 60).toFixed(1)} min${room.state.phase === "over" ? "" : " (time up)"}`);
  room.onAward = undefined;
  await room.disconnect().catch(() => {});
}
WorldRoom.testSeed = null;

console.log(`\nRounds: ${rounds.length}; minutes ${rounds.map((r) => r.minutes).join(", ")}; mean ${(rounds.reduce((n, r) => n + r.minutes, 0) / rounds.length).toFixed(1)}`);
console.log(`Wins by difficulty: ${[...wins].map(([k, n]) => `${k} ${n}`).join(", ")}`);
const systems = [...new Set([...used.values()].flatMap((m) => [...m.keys()]))].sort();
const levels = (["easy", "normal", "hard"] as const).filter((d) => used.has(d));
console.log(`\nSystems used (count per difficulty):\n${["system".padEnd(16), ...levels.map((l) => l.padStart(8))].join("")}`);
for (const s of systems) console.log([s.padEnd(16), ...levels.map((l) => String(used.get(l)?.get(s) ?? 0).padStart(8))].join(""));
const total = [...sources.values()].reduce((n, v) => n + v, 0);
console.log(`\nLetter sources (${total} letters):`);
for (const [k, n] of [...sources].sort((a, b) => b[1] - a[1])) console.log(`${k.padEnd(12)}${String(n).padStart(7)}  ${((n / total) * 100).toFixed(1)}%`);
await server.shutdown();
process.exit(0);
