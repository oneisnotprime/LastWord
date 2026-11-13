import type { Ctx } from "./util.js";

/** One art style: how it draws the shared scene, and what it says about itself. */
export interface Style {
  id: string;
  name: string;
  /** One line on the look. */
  tagline: string;
  /** How an adjective shows (BURNING SWORD, GIANT WOLF). */
  adjectives: string;
  /** How it scales to thousands of words. */
  scaling: string;
  /** Font specs to load before drawing, e.g. "700 20px 'Silkscreen'". */
  fonts: string[];
  /** Colour laid over the scene at night; lights cut holes in it. */
  night: string;
  /** Terrain, areas and things. Called every frame; cache what does not move. */
  world(ctx: Ctx, t: number): void;
  /** Labels, drawn after the night overlay so they stay readable. */
  labels(ctx: Ctx, t: number): void;
  /** The adjective inset, `inset.w` by `inset.h`. */
  inset(ctx: Ctx, t: number): void;
}
