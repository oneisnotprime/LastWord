import type { KitCard, KitLine, KitOption } from "@lastword/shared";

/** One step of the pick at the start of a round, as the server sends it: its three choices, the time left, what was chosen before. */
export interface KitOffer { step: number; options: KitOption[]; seconds: number; chosen: string[] }

/** The four steps of the pick (shared KIT_STEPS), as headed on screen. */
const STEPS = ["Job", "Building", "Legendary", "Letters"];
const STEP_CLASS = ["job", "building", "legend", "hand"];
/** Your kit as it stands: job, building, and the legendary with its progress. */
export interface KitState {
  job: string;
  building: string;
  card: KitCard;
  legend: { word: string; unlock: string; kind: string; counter: string; have: number; need: number; state: "sealed" | "open" | "used" };
}
/** A legendary unsealed (or spelled) somewhere on the map: everyone is told. */
export interface LegendCall { name: string; word: string; how: string; counter: string; spelled: boolean; x: number; y: number }

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const lines = (list: KitLine[]) => list.map((l) => `<li><i>${l.icon}</i>${esc(l.text)}</li>`).join("");
const tiles = (letters: string) => `<span class="tiles">${[...letters].map((c) => `<i>${c.toUpperCase()}</i>`).join("")}</span>`;

/** One kit card: the job, the building, the sealed legendary and the hand, on a sheet of paper. */
function cardHtml(c: KitCard, index: number | null, state = "sealed"): string {
  return `<div class="kitcard"${index !== null ? ` data-pick="${index}"` : ""}>` +
    (index !== null ? `<div class="key">${index + 1}</div>` : "") +
    `<section class="job"><h4>Job</h4><b>${esc(c.job.word.toUpperCase())}</b><ul>${lines(c.job.lines)}</ul></section>` +
    `<section class="building"><h4>Building</h4><b>${esc(c.building.word.toUpperCase())}</b><ul>${lines(c.building.lines)}</ul></section>` +
    `<section class="legend"><h4>Legendary <span class="seal">${state === "open" ? "unsealed" : state === "used" ? "spelled" : "sealed"}</span></h4><b>${esc(c.legend.word.toUpperCase())}</b>` +
    `<div class="unlock">🔒 ${esc(c.legend.unlock)}</div><ul>${lines(c.legend.lines)}</ul>` +
    `<div class="counter">countered by ${esc(c.legend.counter.toUpperCase())}</div></section>` +
    `<section class="hand"><h4>Letters</h4>${tiles(c.letters)}</section></div>`;
}

/** One choice in a step of the pick, on a sheet of paper. */
function optionHtml(step: number, o: KitOption, index: number): string {
  const body = step === 2
    ? `<b>${esc(o.word.toUpperCase())}</b><div class="unlock">🔒 ${esc(o.unlock ?? "")}</div><ul>${lines(o.lines)}</ul><div class="counter">countered by ${esc((o.counter ?? "").toUpperCase())}</div>`
    : step === 3 ? `${tiles(o.letters ?? "")}<ul>${lines(o.lines)}</ul>`
    : `<b>${esc(o.word.toUpperCase())}</b><ul>${lines(o.lines)}</ul>`;
  return `<div class="kitcard" data-pick="${index}"><div class="key">${index + 1}</div><section class="${STEP_CLASS[step]}">${body}</section></div>`;
}

/**
 * Starting kits on screen (PLAN.md "Starting kits"): the pick of three when a round starts (keys
 * 1 to 3 or a click; the server picks for you when time runs out), your job and sealed legendary
 * on the HUD (a click shows your card again), and the map-wide call when a legendary unseals.
 */
export class KitView {
  private readonly root: HTMLElement;
  private readonly call: HTMLElement;
  private timer = 0;
  private callTimer = 0;
  private picking = false;
  private step = 0;
  /** From the first step until your kit arrives (`picking` is off only while a choice is on its way). */
  private inPick = false;
  private kit: KitState | null = null;

  constructor(private readonly onPick: (step: number, index: number) => void, private readonly onUnseal: () => void, private readonly onChange: () => void) {
    this.root = document.createElement("div");
    this.root.id = "kits";
    this.call = document.createElement("div");
    this.call.id = "legendcall";
    document.body.append(this.root, this.call);
    this.root.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      const pick = t.closest<HTMLElement>("[data-pick]");
      if (pick && this.picking) return this.pick(Number(pick.dataset.pick));
      if (t.closest("button.unseal")) return this.onUnseal();
      if (!this.inPick && (t.closest("button.close") || t === this.root)) this.hide();
    });
    document.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest("[data-kit]")) this.showMine();
    });
    // While the pick is up, keys go to it and nowhere else.
    window.addEventListener("keydown", (e) => {
      if (!this.root.classList.contains("show")) return;
      e.stopImmediatePropagation();
      if (this.picking && /^[1-3]$/.test(e.key)) this.pick(Number(e.key) - 1);
      else if (!this.inPick && (e.key === "Escape" || e.key === "Enter")) this.hide();
    }, true);
  }

  /** True while the pick of kits is on screen. */
  get open(): boolean { return this.root.classList.contains("show"); }

  /** True until your kit is picked: from joining through the last step (announcements wait). */
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

  private hide() {
    if (this.inPick) return;
    this.root.className = "";
  }

  /** Your kit as the server tells it. Picked for you (time ran out) closes the pick. */
  set(k: KitState) {
    const was = this.kit?.legend.state;
    this.kit = k;
    if (this.inPick) { this.picking = this.inPick = false; clearInterval(this.timer); this.root.className = ""; }
    if (was === "sealed" && k.legend.state === "open") this.showMine();
    else if (this.open && !this.picking) this.showMine();
    this.onChange();
  }

  /** Your kit's lines for the HUD card: the job, and the legendary with how far toward unsealing it. */
  hudHtml(): string {
    const k = this.kit;
    if (!k) return "";
    const l = k.legend;
    const pct = Math.round((100 * Math.min(l.have, l.need)) / Math.max(1, l.need));
    const state = l.state === "open" ? `<em class="open">UNSEALED: spell it free</em>` : l.state === "used" ? `<em>spelled</em>`
      : `<span class="track"><i style="width:${pct}%"></i><em>${l.have} / ${l.need}</em></span>`;
    return `<div class="kitrow" data-kit="1" title="Your kit: click for the card"><span>Job</span><b>${esc(k.job.toUpperCase())}</b>` +
      `<span>Legend</span><b class="legend ${l.state}">${l.state === "sealed" ? "🔒 " : l.state === "open" ? "✨ " : ""}${esc(l.word.toUpperCase())}</b>` +
      `<small>${esc(l.unlock)}</small>${state}</div>`;
  }

  /** Your own kit card, with Unseal when its letters are what open it and you hold them. */
  showMine() {
    const k = this.kit;
    if (!k || this.inPick) return;
    const l = k.legend;
    const can = l.state === "sealed" && l.kind === "letters" && l.have >= l.need;
    const status = l.state === "open" ? "Unsealed: spell it once, free" : l.state === "used" ? "Spelled" : `${l.have} / ${l.need}`;
    this.root.innerHTML = `<div class="sheet mine"><h2>Your kit</h2><div class="hint">${esc(status)}</div><div class="cards">${cardHtml(k.card, null, l.state)}</div>` +
      `<div class="buttons">${can ? `<button class="unseal">Unseal ${esc(l.word.toUpperCase())}</button>` : ""}<button class="close">Close</button></div></div>`;
    this.root.className = "show";
  }

  /** A legendary unsealed or spelled somewhere: a call across the whole screen. */
  announce(c: LegendCall, mine: boolean) {
    const who = mine ? "YOU" : c.name.toUpperCase();
    this.call.innerHTML = c.spelled
      ? `<small>the legend walks</small><b>${esc(who)} SPELLED ${esc(c.word.toUpperCase())}</b><span>counter it with ${esc(c.counter.toUpperCase())}</span>`
      : `<small>a seal breaks</small><b>${esc(who)} UNSEALED ${esc(c.word.toUpperCase())}</b><span>${esc(c.how)} · counter: ${esc(c.counter.toUpperCase())}</span>`;
    this.call.className = "";
    void this.call.offsetWidth; // restart the animation
    this.call.className = "show";
    clearTimeout(this.callTimer);
    this.callTimer = window.setTimeout(() => (this.call.className = ""), 6500);
  }
}
