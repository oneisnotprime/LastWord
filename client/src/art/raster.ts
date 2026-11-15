/**
 * Generated word art: palette-snapped cut-outs made ahead of time by tools/art (one small WebP per
 * word in public/art/words, listed in manifest.json). A word's image is fetched the first time
 * it is drawn; until it arrives the word keeps its hand-made or archetype shape. The standee
 * renderer adds the paper border, shadow, stand and effects, so they sit with the drawn shapes.
 */

export interface Raster {
  img: CanvasImageSource;
  /** Pixel size of the image. */
  w: number; h: number;
  /** The top edge in five bands across, 0 top to 1 bottom: where flames go. */
  top: number[];
}

interface Manifest { v: number; px: number; words: Record<string, [string, number, number, number[]]>; alias: Record<string, string> }

const BASE = `${import.meta.env?.BASE_URL ?? "/"}art/words/`;
let manifest: Manifest | null = null;
let asked = false;
const ready = new Map<string, Raster>();
const pending = new Set<string>();
const listeners: (() => void)[] = [];

/** Whether this browser can load images at all (not in tests). */
const canLoad = () => typeof Image !== "undefined" && typeof fetch !== "undefined";

/** Fetches the list of generated images once. Words drawn before it arrives get theirs after. */
export function loadManifest(): Promise<void> {
  if (asked || !canLoad()) return Promise.resolve();
  asked = true;
  return fetch(`${BASE}manifest.json`).then((r) => (r.ok ? r.json() : null)).then((m: Manifest | null) => {
    manifest = m;
    if (m) for (const fn of listeners) fn();
  }).catch(() => { /* no generated art: hand-made shapes only */ });
}

/** Called when an image (or the manifest) arrives, so cached standees can be redrawn. */
export function onRaster(fn: () => void) { listeners.push(fn); }

/** The word whose image a word uses (EYES uses EYE's), or undefined when it has none. */
export function rasterWord(word: string): string | undefined {
  if (!manifest) return undefined;
  if (manifest.words[word]) return word;
  const a = manifest.alias[word];
  return a && manifest.words[a] ? a : undefined;
}

/** The image for a word if it has loaded; asks for it if not. */
export function rasterOf(word: string): Raster | undefined {
  if (!asked) void loadManifest();
  const key = rasterWord(word);
  if (!key) return undefined;
  const r = ready.get(key);
  if (r || pending.has(key)) return r;
  pending.add(key);
  const [file, w, h, top] = manifest!.words[key]!;
  const img = new Image();
  img.decoding = "async";
  img.onload = () => {
    ready.set(key, { img, w, h, top });
    pending.delete(key);
    for (const fn of listeners) fn();
  };
  img.onerror = () => { /* keep the drawn shape */ };
  img.src = BASE + file;
  return undefined;
}

/** Every word with a generated image, for the gallery. */
export async function rasterWords(): Promise<string[]> {
  await loadManifest();
  return manifest ? Object.keys(manifest.words) : [];
}

/** Waits until the images for these words have loaded (gallery and tests). */
export async function preload(words: string[]): Promise<void> {
  await loadManifest();
  await Promise.all(words.map((w) => new Promise<void>((done) => {
    const key = rasterWord(w);
    if (!key || ready.has(key)) return done();
    rasterOf(w);
    const t = setInterval(() => { if (ready.has(key)) { clearInterval(t); done(); } }, 30);
    setTimeout(() => { clearInterval(t); done(); }, 8000);
  })));
}
