/** Draws terrain chunks off the main thread, so walking into new ground never stalls a frame. */
import type { WorldMap } from "@lastword/shared";
import { renderChunk } from "./terrain.js";

export type ToWorker =
  | { type: "map"; size: number; tiles: Uint8Array }
  | { type: "chunk"; cx: number; cy: number; T: number; ticket: number };
export interface FromWorker { cx: number; cy: number; ticket: number; bitmap: ImageBitmap; ms: number }

let map: WorldMap | null = null;

self.onmessage = (e: MessageEvent<ToWorker>) => {
  const m = e.data;
  if (m.type === "map") { map = { seed: 0, size: m.size, tiles: m.tiles, cities: [] }; return; }
  if (!map) return;
  const { canvas, ms } = renderChunk(map, m.cx, m.cy, m.T);
  const bitmap = (canvas as OffscreenCanvas).transferToImageBitmap();
  (self as unknown as Worker).postMessage({ cx: m.cx, cy: m.cy, ticket: m.ticket, bitmap, ms } satisfies FromWorker, [bitmap]);
};
