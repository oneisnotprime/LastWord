import type { Style } from "./style.js";
export const pixelStyle: Style = { id: "pixel", name: "pixel", tagline: "", adjectives: "", scaling: "", fonts: [], night: "rgba(0,0,0,.6)", world(ctx) { ctx.fillStyle = "#333"; ctx.fillRect(0, 0, 992, 768); }, labels() {}, inset() {} };
