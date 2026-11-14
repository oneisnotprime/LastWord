/** The craft palette: paper colours for materials, colour words, and shading. */

export const PAPER = "#fbf7ec";
export const INK = "#4a3f33";
export const HAND = "'Kalam', 'Comic Sans MS', cursive";
export const ROUND = "'Fredoka', 'Trebuchet MS', sans-serif";

/** The paper a material is cut from. */
export const MATERIAL: Record<string, string> = {
  steel: "#c9d1d6", iron: "#7d7f80", lead: "#6a6e78", aluminum: "#d6dadc", titanium: "#a9b0b8", nickel: "#b9bcb4", brass: "#d2a84a", bronze: "#b5793a",
  copper: "#c9773a", gold: "#e3b341", silver: "#d0d6da", uranium: "#9bc26a",
  wood: "#a8703c", cork: "#c99a6a", nut: "#8a5a3a", hay: "#e3c46a", paper: "#f2ead8", cardboard: "#c9a77a", canvas: "#d9c9a6", cloth: "#c9775a",
  cotton: "#f2ead8", wool: "#efe9dc", silk: "#e9c9d4", leather: "#8a5a3a", fiber: "#c9b896", rubber: "#3d3a3a", plastic: "#5fa3c9", vinyl: "#3d3a40",
  celluloid: "#e3d6bc", resin: "#d99a3a", lacquer: "#a83a3a", paint: "#5f8ac9", ink: "#2f3a5a",
  brick: "#b5654a", stone: "#a39b8c", concrete: "#b3b0a8", marble: "#efeae2", basalt: "#4a4a4e", tile: "#c9775a", plaster: "#efe4cf", clay: "#c9875a",
  ceramic: "#efe4cf", porcelain: "#f6f2ea", glass: "#bfe0e6", silicon: "#7a8a9a", charcoal: "#3a3633", asphalt: "#4a4a4a", dirt: "#8a6a4a", earth: "#8a6a4a",
  bone: "#efe6d0", flesh: "#e0a890", acid: "#b5d94a", mixed: "#b9b077",
};

/** Colour words. */
export const COLOUR: Record<string, string> = {
  black: "#3a3633", gray: "#9a9a9e", grey: "#9a9a9e", white: "#f6f2ea", red: "#c9453f", green: "#5f9a4a", blue: "#3f6fa8", brown: "#8a5a3a",
  pink: "#e88aa5", purple: "#8a5ac9", yellow: "#e9c24a", copper: "#c9773a", orange: "#e8892e", checkered: "#c9c4b8", gold: "#e3b341", silver: "#d0d6da",
};

const hex = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const out = ([r, g, b]: number[]) => "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v!))).toString(16).padStart(2, "0")).join("");

/** Mixes two colours: t 0 is a, 1 is b. */
export function mix(a: string, b: string, t: number): string {
  const x = hex(a), y = hex(b);
  return out(x.map((v, i) => v + (y[i]! - v) * t));
}

/** Lighter (k > 0, toward paper) or darker (k < 0, toward brown-black) shade. */
export function shade(c: string, k: number): string {
  return k >= 0 ? mix(c, "#fffaf0", k) : mix(c, "#2a2018", -k);
}

/** Hex colour to a Phaser number. */
export const num = (c: string) => parseInt(c.slice(1), 16);
