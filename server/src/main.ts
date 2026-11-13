import server from "./app.config.js";
import { liveRooms } from "./WorldRoom.js";

const port = Number(process.env.PORT ?? 2567);
await server.listen(port);
console.log(`Last Word server listening on ${port}`);

// METRICS=1 prints load figures every ten seconds, for the bot test.
if (process.env.METRICS) {
  let cpu = process.cpuUsage(), at = performance.now();
  setInterval(() => {
    const used = process.cpuUsage(cpu), now = performance.now();
    const percent = ((used.user + used.system) / 1000 / (now - at)) * 100;
    cpu = process.cpuUsage(); at = now;
    for (const room of liveRooms) {
      const m = room.metrics;
      console.log(
        `metrics clients=${room.clients.length} cpu=${percent.toFixed(1)}% ` +
        `tick_avg_ms=${(m.tickMsTotal / Math.max(1, m.ticks)).toFixed(3)} tick_max_ms=${m.tickMsMax.toFixed(2)} ` +
        `rss_mb=${(process.memoryUsage().rss / 2 ** 20).toFixed(0)}`,
      );
      room.metrics = { ticks: 0, tickMsTotal: 0, tickMsMax: 0 };
    }
  }, 10_000);
}
