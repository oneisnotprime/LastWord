import { seeded, tipText, wordIdeas, type Dictionary, type Letters, type Rng, type WordTip } from "@lastword/shared";

/**
 * Teaching tips (shared `tips.ts`): word cards on the start screen, one line in the idle spell
 * window, and word ideas in the menu. One setting turns them off, kept in this browser.
 */

const KEY = "lastword.tips";

export function tipsOn(): boolean {
  try { return localStorage.getItem(KEY) !== "off"; } catch { return true; }
}

export function setTipsOn(on: boolean): void {
  try { localStorage.setItem(KEY, on ? "on" : "off"); } catch { /* not remembered */ }
}

/** A fresh generator for tips (the client may pick at random; the rules may not). */
export const tipRng = (): Rng => seeded((Math.random() * 2 ** 32) >>> 0);

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** A word idea as a small card: the word, its kind, what it does and what beats it. */
export function ideaHtml(t: WordTip): string {
  const kind = tipText(t).match(/^\S+ \(([^)]*)\)/)?.[1] ?? t.kind;
  return `<div class="idea" title="${esc(tipText(t))}"><b>${esc(t.word.toUpperCase())}</b> <span class="k">${esc(kind)}</span>` +
    `<div class="d">${esc(t.does)}</div>${t.counter ? `<div class="c">countered by <b>${esc(t.counter.toUpperCase())}</b></div>` : ""}</div>`;
}

/** Word ideas as cards, for `held` letters. */
export const ideasHtml = (dict: Dictionary, held: Letters, n: number, rng = tipRng()) => wordIdeas(dict, held, rng, n).map(ideaHtml).join("");

/** Shared card styles for word ideas (the start screen and the menu). */
export const IDEA_CSS = `
.idea { text-align: left; padding: 4px 8px 5px; margin: 4px 0; background: #f3ead6; border-radius: 3px; box-shadow: inset 0 1px 2px rgba(60, 40, 20, .15);
  font: 500 12px/1.35 'Fredoka', 'Trebuchet MS', sans-serif; color: #4a3f33; }
.idea > b { font: 700 15px 'Kalam', cursive; letter-spacing: 1px; }
.idea .k { font: 600 9.5px 'Fredoka', sans-serif; text-transform: uppercase; letter-spacing: 1px; color: #8a7a60; }
.idea .d { color: #8a5a1a; }
.idea .c { color: #8a7a60; font-size: 11px; } .idea .c b { color: #c9453f; }`;
