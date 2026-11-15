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
import { sourceOf, THEME_SYSTEMS, type Difficulty } from "../src/bots.js";
import { WorldRoom } from "../src/WorldRoom.js";

const [rooms = 4, bots = 8] = process.argv.slice(2, 4).map(Number);
const mode = (process.argv[4] ?? "mixed") as Difficulty | "mixed";
const cap = Number(process.argv[5] ?? 60);

const server = await boot(appConfig);
const used = new Map<Difficulty, Map<string, number>>();
const sources = new Map<string, number>();
const rounds: { minutes: number; winner: string; difficulty: string }[] = [];
const wins = new Map<string, number>();
const themedUsers = new Map<string, number>();
// Time to kill: from the first blow of the fight that ended in a death (a gap of ENGAGE_GAP seconds
// with no damage starts a new fight) to the death, for people and for creatures; and what killed.
const ENGAGE_GAP = 10;
const ttk = { person: [] as number[], creature: [] as number[] };
const firstDeaths: number[] = [];
const killers = new Map<string, number>();

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
  const fightFrom = new Map<string, { from: number; last: number }>();
  const anyRoom = room as any;
  const blow = anyRoom.blow.bind(room), kill = anyRoom.kill.bind(room);
  let firstDeath = 0;
  anyRoom.blow = (by: string, on: string, r: { hit: boolean; damage: number }, ...rest: unknown[]) => {
    if (r.hit && r.damage > 0 && anyRoom.walkers.has(on)) {
      const f = fightFrom.get(on);
      if (!f || seconds - f.last > ENGAGE_GAP) fightFrom.set(on, { from: seconds, last: seconds }); else f.last = seconds;
    }
    return blow(by, on, r, ...rest);
  };
  anyRoom.kill = (id: string, killerId: string) => {
    const w = anyRoom.walkers.get(id);
    if (w && w.master !== "-" && w.citizenOf === undefined) {
      const f = fightFrom.get(id);
      const t = f ? seconds - f.from : 0;
      (w.master === null ? ttk.person : ttk.creature).push(t);
      if (w.master === null && !firstDeath) { firstDeath = seconds; firstDeaths.push(seconds); }
      if (w.master === null) { const k = anyRoom.walkers.get(killerId); const what = k ? (k.master === null ? (k.unit?.weapon ?? "fists") : k.body?.noun ?? k.player.name) : "area/other"; killers.set(String(what), (killers.get(String(what)) ?? 0) + 1); }
    }
    fightFrom.delete(id);
    return kill(id, killerId);
  };
  while (room.state.phase !== "over" && seconds < cap * 60) { room.update(0.1); seconds += 0.1; }
  const report = room.botReport();
  for (const b of report) {
    const m = used.get(b.difficulty) ?? used.set(b.difficulty, new Map()).get(b.difficulty)!;
    for (const [k, n] of Object.entries(b.used)) { m.set(k, (m.get(k) ?? 0) + n); if (n > 0) themedUsers.set(k, (themedUsers.get(k) ?? 0) + 1); }
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
const pct = (a: number[], q: number) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(q * b.length))]!.toFixed(1) : "-"; };
for (const [k, a] of Object.entries(ttk)) console.log(`Time to kill (${k}s, ${a.length}): median ${pct(a, 0.5)} s, p25 ${pct(a, 0.25)}, p75 ${pct(a, 0.75)}, under 2 s ${a.filter((t) => t < 2).length}`);
console.log(`First person dead at: ${firstDeaths.map((t) => (t / 60).toFixed(2)).join(", ")} min`);
console.log(`People killed by: ${[...killers].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, n]) => `${k} ${n}`).join(", ")}`);
const systems = [...new Set([...used.values()].flatMap((m) => [...m.keys()]))].sort();
const levels = (["easy", "normal", "hard"] as const).filter((d) => used.has(d));
console.log(`\nSystems used (count per difficulty):\n${["system".padEnd(16), ...levels.map((l) => l.padStart(8))].join("")}`);
for (const s of systems) console.log([s.padEnd(16), ...levels.map((l) => String(used.get(l)?.get(s) ?? 0).padStart(8))].join(""));
const themed = [...THEME_SYSTEMS, ...systems.filter((k) => k.startsWith("cure ") && !(THEME_SYSTEMS as readonly string[]).includes(k))];
console.log(`\nThemes' systems (count per difficulty; bots that used each at least once):\n${["system".padEnd(16), ...levels.map((l) => l.padStart(8)), "  bots"].join("")}`);
for (const k of themed) {
  const users = themedUsers.get(k) ?? 0;
  console.log([k.padEnd(16), ...levels.map((l) => String(used.get(l)?.get(k) ?? 0).padStart(8)), String(users).padStart(6)].join(""));
}
const unused = themed.filter((k) => !(themedUsers.get(k) ?? 0));
console.log(`Themes' systems used: ${themed.length - unused.length} of ${themed.length}${unused.length ? `; never: ${unused.join(", ")}` : ""}`);
const total = [...sources.values()].reduce((n, v) => n + v, 0);
console.log(`\nLetter sources (${total} letters):`);
for (const [k, n] of [...sources].sort((a, b) => b[1] - a[1])) console.log(`${k.padEnd(12)}${String(n).padStart(7)}  ${((n / total) * 100).toFixed(1)}%`);
await server.shutdown();
process.exit(0);
