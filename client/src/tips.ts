import { seeded, tipText, TIP_LABEL, wordIdeas, type Dictionary, type Letters, type Rng, type WordTip } from "@lastword/shared";

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

/** A word idea as a small card in two columns: the word and its kind (and counter) left, its properties with what each means right. */
export function ideaHtml(t: WordTip): string {
  const kind = TIP_LABEL[t.kind] ?? t.kind;
  return `<div class="idea" title="${esc(tipText(t))}"><div class="w"><b>${esc(t.word.toUpperCase())}</b><span class="k">${esc(kind)}</span>` +
    `${t.counter ? `<div class="c">countered by <b>${esc(t.counter.toUpperCase())}</b></div>` : ""}</div>` +
    `<ul class="p">${t.lines.map((l) => `<li><span class="d">${esc(l.text)}</span>${l.why ? `<small>${esc(l.why)}</small>` : ""}</li>`).join("")}</ul></div>`;
}

/** The column heads over word ideas. */
export const IDEA_HEAD = `<div class="ideahead"><span>Words</span><span>Properties</span></div>`;

/** Word ideas as cards, for `held` letters. */
export const ideasHtml = (dict: Dictionary, held: Letters, n: number, rng = tipRng()) => IDEA_HEAD + wordIdeas(dict, held, rng, n).map(ideaHtml).join("");

/** Shared card styles for word ideas (the start screen and the menu). */
export const IDEA_CSS = `
.idea { display: grid; grid-template-columns: 34% 1fr; gap: 8px; text-align: left; padding: 5px 8px 6px; margin: 4px 0; background: #f3ead6; border-radius: 3px; box-shadow: inset 0 1px 2px rgba(60, 40, 20, .15);
  font: 500 12px/1.3 'Fredoka', 'Trebuchet MS', sans-serif; color: #4a3f33; }
.idea .w > b { display: block; font: 700 15px/1.2 'Kalam', cursive; letter-spacing: 1px; }
.idea .k { font: 600 9.5px 'Fredoka', sans-serif; text-transform: uppercase; letter-spacing: 1px; color: #8a7a60; }
.idea .p { list-style: none; margin: 0; padding: 0; }
.idea .p li { margin: 1px 0; }
.idea .d { color: #8a5a1a; font-weight: 600; }
.idea .p small { display: block; color: #8a7a60; font-size: 10.5px; line-height: 1.2; }
.idea .c { color: #8a7a60; font-size: 11px; margin-top: 2px; } .idea .c b { color: #c9453f; }
.ideahead { display: grid; grid-template-columns: 34% 1fr; gap: 8px; padding: 0 8px; text-align: left; font: 600 10px 'Fredoka', sans-serif; text-transform: uppercase; letter-spacing: 1.5px; color: #8a7a60; }`;
