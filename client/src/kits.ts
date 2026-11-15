import type { KitCard, KitLine, KitOption } from "@lastword/shared";

/** One step of the pick at the start of a round, as the server sends it: its three choices, the time left, what was chosen before. */
export interface KitOffer { step: number; options: KitOption[]; seconds: number; chosen: string[] }

/** The three steps of the pick (shared KIT_STEPS), as headed on screen. */
const STEPS = ["Job", "Building", "Letters"];
const STEP_CLASS = ["job", "building", "hand"];
/** Your kit: job, building and its card. */
export interface KitState { job: string; building: string; card: KitCard }

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const lines = (list: KitLine[]) => list.map((l) => `<li><i>${l.icon}</i>${esc(l.text)}</li>`).join("");
const tiles = (letters: string) => `<span class="tiles">${[...letters].map((c) => `<i>${c.toUpperCase()}</i>`).join("")}</span>`;

/** One choice in a step of the pick, on a sheet of paper. */
function optionHtml(step: number, o: KitOption, index: number): string {
  const body = STEPS[step] === "Letters" ? `${tiles(o.letters ?? "")}<ul>${lines(o.lines)}</ul>`
    : `<b>${esc(o.word.toUpperCase())}</b><ul>${lines(o.lines)}</ul>`;
  return `<div class="kitcard" data-pick="${index}"><div class="key">${index + 1}</div><section class="${STEP_CLASS[step]}">${body}</section></div>`;
}

/**
 * Starting kits on screen (PLAN.md "Starting kits"): the pick in three steps when a round starts
 * (keys 1 to 3 or a click; the server picks for you when time runs out).
 */
export class KitView {
  private readonly root: HTMLElement;
  private timer = 0;
  private picking = false;
  private step = 0;
  /** From the first step until your kit arrives (`picking` is off only while a choice is on its way). */
  private inPick = false;

  constructor(private readonly onPick: (step: number, index: number) => void) {
    this.root = document.createElement("div");
    this.root.id = "kits";
    document.body.append(this.root);
    this.root.addEventListener("click", (e) => {
      const pick = (e.target as HTMLElement).closest<HTMLElement>("[data-pick]");
      if (pick && this.picking) this.pick(Number(pick.dataset.pick));
    });
    // While the pick is up, keys go to it and nowhere else.
    window.addEventListener("keydown", (e) => {
      if (!this.root.classList.contains("show")) return;
      e.stopImmediatePropagation();
      if (this.picking && /^[1-3]$/.test(e.key)) this.pick(Number(e.key) - 1);
    }, true);
  }

  /** True while the pick of kits is on screen. */
  get open(): boolean { return this.root.classList.contains("show"); }

  /** True until your kit is picked: from joining through the last step. */
  get choosing(): boolean { return this.inPick; }

  /** A step of the pick: its three choices, the steps so far, and the time left. */
  offer(o: KitOffer) {
    this.picking = true;
    this.inPick = true;
    this.step = o.step;
    let left = o.seconds;
    const crumbs = STEPS.map((name, i) => `<span class="${i === o.step ? "now" : i < o.step ? "done" : ""}">${i + 1} ${name}${o.chosen[i] ? ` <b>${esc(o.chosen[i]!.toUpperCase())}</b>` : ""}</span>`).join("");
    this.root.innerHTML = `<div class="sheet"><h2>Choose your kit <b class="left">${left}s</b></h2><div class="steps">${crumbs}</div>` +
      `<div class="cards">${o.options.map((c, i) => optionHtml(o.step, c, i)).join("")}</div></div>`;
    this.root.className = "show";
    clearInterval(this.timer);
    this.timer = window.setInterval(() => {
      left = Math.max(0, left - 1);
      const el = this.root.querySelector(".left");
      if (el) el.textContent = `${left}s`;
      if (left <= 0) clearInterval(this.timer);
    }, 1000);
  }

  /** A choice made: sent, and the sheet waits for the next step (or your kit) from the server. */
  private pick(index: number) {
    if (!this.picking) return;
    this.picking = false;
    clearInterval(this.timer);
    this.root.querySelector(`[data-pick="${index}"]`)?.classList.add("picked");
    this.onPick(this.step, index);
  }

  /** Your kit as the server tells it: the pick is over (picked for you if time ran out). */
  set(_k: KitState) {
    if (this.inPick) { this.picking = this.inPick = false; clearInterval(this.timer); this.root.className = ""; }
  }
}
