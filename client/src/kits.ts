import type { KitCard, KitLine } from "@lastword/shared";

/** The kits offered at the start of a round, as the server sends them. */
export interface KitOffer { cards: KitCard[]; seconds: number }
/** Your kit: job, building and its card. */
export interface KitState { job: string; building: string; card: KitCard }

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const lines = (list: KitLine[]) => list.map((l) => `<li><i>${l.icon}</i>${esc(l.text)}</li>`).join("");
const tiles = (letters: string) => `<span class="tiles">${[...letters].map((c) => `<i>${c.toUpperCase()}</i>`).join("")}</span>`;

/** One kit card: the job, the building and the hand, on a sheet of paper. */
function cardHtml(c: KitCard, index: number | null): string {
  return `<div class="kitcard"${index !== null ? ` data-pick="${index}"` : ""}>` +
    (index !== null ? `<div class="key">${index + 1}</div>` : "") +
    `<section class="job"><h4>Job</h4><b>${esc(c.job.word.toUpperCase())}</b><ul>${lines(c.job.lines)}</ul></section>` +
    `<section class="building"><h4>Building</h4><b>${esc(c.building.word.toUpperCase())}</b><ul>${lines(c.building.lines)}</ul></section>` +
    `<section class="hand"><h4>Letters</h4>${tiles(c.letters)}</section></div>`;
}

/**
 * Starting kits on screen (PLAN.md "Starting kits"): the pick of three when a round starts (keys
 * 1 to 3 or a click; the server picks for you when time runs out).
 */
export class KitView {
  private readonly root: HTMLElement;
  private timer = 0;
  private picking = false;

  constructor(private readonly onPick: (index: number) => void) {
    this.root = document.createElement("div");
    this.root.id = "kits";
    document.body.append(this.root);
    this.root.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      const pick = t.closest<HTMLElement>("[data-pick]");
      if (pick && this.picking) return this.pick(Number(pick.dataset.pick));
      if (!this.picking && (t.closest("button.close") || t === this.root)) this.hide();
    });
    // While the pick is up, keys go to it and nowhere else.
    window.addEventListener("keydown", (e) => {
      if (!this.root.classList.contains("show")) return;
      e.stopImmediatePropagation();
      if (this.picking && /^[1-3]$/.test(e.key)) this.pick(Number(e.key) - 1);
      else if (!this.picking && (e.key === "Escape" || e.key === "Enter")) this.hide();
    }, true);
  }

  /** True while the pick of kits is on screen. */
  get open(): boolean { return this.root.classList.contains("show"); }

  /** The kits to pick from, with the time left. */
  offer(o: KitOffer) {
    this.picking = true;
    let left = o.seconds;
    const draw = () => {
      this.root.innerHTML = `<div class="sheet"><h2>Choose your kit</h2><div class="hint">A job, a building where you stand and eight letters. ` +
        `<b class="left">${left}s</b></div><div class="cards">${o.cards.map((c, i) => cardHtml(c, i)).join("")}</div></div>`;
    };
    draw();
    this.root.className = "show";
    clearInterval(this.timer);
    this.timer = window.setInterval(() => {
      left = Math.max(0, left - 1);
      const el = this.root.querySelector(".left");
      if (el) el.textContent = `${left}s`;
      if (left <= 0) clearInterval(this.timer);
    }, 1000);
  }

  private pick(index: number) {
    if (!this.picking) return;
    this.picking = false;
    clearInterval(this.timer);
    this.onPick(index);
    this.hide();
  }

  private hide() {
    if (this.picking) return;
    this.root.className = "";
  }

  /** Your kit as the server tells it. Picked for you (time ran out) closes the pick. */
  set(_k: KitState) {
    if (this.picking) { this.picking = false; clearInterval(this.timer); this.root.className = ""; }
  }
}
