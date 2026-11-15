/**
 * Paper effects drawn in HTML over the game: letter popups that fly to the letter bar, floating
 * damage numbers, the red edge when you are hit, and a short note when gathering fails. World
 * positions are turned into screen positions each frame by `toScreen`, so they stay on what
 * they belong to while the camera moves.
 */
import type { Got } from "./net.js";

export type ToScreen = (x: number, y: number) => { x: number; y: number };

/** Most damage numbers on screen at once; older ones go first. */
const MAX_NUMBERS = 40;
/** Most letter popups waiting their turn; past that, they are merged into the last. */
const MAX_QUEUE = 8;
/** Most letters of one popup that fly down one by one, and the milliseconds between them. */
const MAX_CASCADE = 16;
const CASCADE_GAP = 110;

interface Floating { el: HTMLElement; x: number; y: number; born: number; life: number; rise: number }

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** "E", "H H", or "+23" for a big pile: what a popup's tile shows. */
export function tileText(letters: string): string {
  return letters.length <= 3 ? letters.toUpperCase().split("").join("") : `+${letters.length}`;
}

/** The reason tag under a popup's tile: "E · forage", "H · hunted COW (+12 food)", "+23 · BOT3's letters". */
export function reasonTag(g: Pick<Got, "letters" | "why">): string {
  const head = g.letters.length <= 3 ? g.letters.toUpperCase().split("").join(" ") : `+${g.letters.length}`;
  return `${head} · ${g.why}`;
}

export class Effects {
  private layer: HTMLElement;
  private numbers: Floating[] = [];
  private queue: Got[] = [];
  private busyUntil = 0;
  private hurtTimer = 0;

  constructor(private readonly toScreen: ToScreen) {
    this.layer = document.createElement("div");
    this.layer.id = "fx";
    document.body.append(this.layer);
  }

  /** Letters gained: queued, one popup every so often so each can be read. */
  got(g: Got) {
    if (this.queue.length >= MAX_QUEUE) {
      const last = this.queue.at(-1)!;
      last.letters += g.letters;
      last.why = last.why === g.why ? last.why : "many things";
      return;
    }
    this.queue.push({ ...g });
  }

  /**
   * A letter tile pops out of where it came from, bigger than life, with a burst and its
   * reason tag; then flies down to its tile in the letter bar, which bounces as it lands.
   */
  private pop(g: Got) {
    const from = this.toScreen(g.x, g.y);
    const el = document.createElement("div");
    el.className = "pop";
    el.innerHTML = `<div class="big">${esc(tileText(g.letters))}</div><div class="why">${esc(reasonTag(g))}</div>${g.detail ? `<div class="detail">${esc(g.detail)}</div>` : ""}`;
    el.style.left = `${from.x}px`;
    el.style.top = `${from.y}px`;
    this.layer.append(el);
    this.sparkle(from.x, from.y - 30, 14, ["#e9b949", "#fbf7ec", "#d9573b", "#5f9a4a", "#2f8aa8"]);
    const big = el.querySelector<HTMLElement>(".big")!, why = el.querySelector<HTMLElement>(".why")!;
    el.animate([
      { transform: "translate(-50%, -50%) scale(0.2)", opacity: 0 },
      { transform: "translate(-50%, -150%) scale(1.25)", opacity: 1, offset: 0.55 },
      { transform: "translate(-50%, -140%) scale(1)", opacity: 1 },
    ], { duration: 520, easing: "cubic-bezier(.2,1.4,.4,1)", fill: "forwards" });
    big.animate([{ transform: "rotate(-30deg)" }, { transform: "rotate(8deg)", offset: 0.6 }, { transform: "rotate(-3deg)" }], { duration: 520, fill: "forwards" });
    window.setTimeout(() => {
      why.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" });
      el.querySelector<HTMLElement>(".detail")?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" });
      const box = big.getBoundingClientRect();
      big.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: "forwards" });
      window.setTimeout(() => el.remove(), 400);
      this.cascade(g.letters, { x: box.left + box.width / 2, y: box.top + box.height / 2 });
    }, 1300);
  }

  /**
   * Each new letter flies down to its own tile in the letter bar, one after another; only the
   * tile it lands on bounces and lights up, briefly. The k-th new copy of a letter goes to the
   * k-th tile of it from the end (copies are added at the end), or to its one counted tile.
   */
  private cascade(letters: string, from: { x: number; y: number }) {
    const list = [...letters.toLowerCase()].slice(0, MAX_CASCADE);
    const seen: Record<string, number> = {};
    list.forEach((ch, i) => {
      const k = (seen[ch] = (seen[ch] ?? -1) + 1);
      const fly = document.createElement("div");
      fly.className = "fly";
      fly.textContent = ch.toUpperCase();
      fly.style.left = `${from.x}px`;
      fly.style.top = `${from.y}px`;
      fly.style.opacity = "0";
      this.layer.append(fly);
      window.setTimeout(() => {
        const tiles = [...document.querySelectorAll<HTMLElement>(`#letters .tile[data-letter="${ch}"]`)];
        const target = tiles[Math.max(0, tiles.length - 1 - k)] ?? document.getElementById("letters");
        const r = target?.getBoundingClientRect();
        const to = r && r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: innerWidth / 2, y: innerHeight - 40 };
        const dx = to.x - from.x, dy = to.y - from.y, spread = (i - (list.length - 1) / 2) * 26;
        fly.style.opacity = "1";
        fly.animate([
          { transform: "translate(-50%, -50%) scale(1.4) rotate(-10deg)" },
          { transform: `translate(calc(-50% + ${dx * 0.35 + spread}px), calc(-50% + ${dy * 0.35 - 50}px)) scale(1.1) rotate(180deg)`, offset: 0.45 },
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.8) rotate(360deg)` },
        ], { duration: 620, easing: "cubic-bezier(.5,0,.6,1)", fill: "forwards" }).onfinish = () => {
          fly.remove();
          this.sparkle(to.x, to.y, 6, ["#e9b949", "#fff3c4"]);
          // Look the tile up again: the bar may have been redrawn while this one flew.
          const now = [...document.querySelectorAll<HTMLElement>(`#letters .tile[data-letter="${ch}"]`)];
          const t = now[Math.max(0, now.length - 1 - k)];
          if (!t) return;
          t.classList.remove("landed");
          void t.offsetWidth;
          t.classList.add("landed");
          t.addEventListener("animationend", () => t.classList.remove("landed"), { once: true });
        };
      }, i * CASCADE_GAP);
    });
  }

  /** Paper confetti bursting from a screen point. */
  private sparkle(x: number, y: number, n: number, colours: string[]) {
    for (let i = 0; i < n; i++) {
      const s = document.createElement("i");
      s.className = "spark";
      s.style.left = `${x}px`;
      s.style.top = `${y}px`;
      s.style.background = colours[i % colours.length]!;
      this.layer.append(s);
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4, r = 26 + Math.random() * 30;
      s.animate([
        { transform: "translate(-50%, -50%) scale(1) rotate(0deg)", opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(a) * r}px), calc(-50% + ${Math.sin(a) * r + 14}px)) scale(0.4) rotate(200deg)`, opacity: 0 },
      ], { duration: 600 + Math.random() * 300, easing: "cubic-bezier(.1,.7,.4,1)" }).onfinish = () => s.remove();
    }
  }

  /** A short red note over a world point: "✕ picked clean". */
  fail(x: number, y: number, text: string, small = false) {
    const el = document.createElement("div");
    el.className = small ? "fail small" : "fail";
    el.textContent = `✕ ${text}`;
    this.layer.append(el);
    this.numbers.push({ el, x, y, born: performance.now(), life: 1800, rise: 26 });
  }

  /** A small neutral note over a world point ("+sight"). */
  note(x: number, y: number, text: string) {
    const el = document.createElement("div");
    el.className = "fail small note";
    el.textContent = text;
    this.layer.append(el);
    this.numbers.push({ el, x, y, born: performance.now(), life: 1800, rise: 26 });
  }

  /**
   * A damage number over a world point: bigger and gold for a critical blow, grey when armour or a
   * vehicle took it (named), "miss" for a miss.
   */
  number(x: number, y: number, amount: number, kind: "hit" | "crit" | "miss" | "blocked" | "dodged", layer: string, mine: boolean) {
    if (this.numbers.length >= MAX_NUMBERS) this.numbers.shift()!.el.remove();
    const el = document.createElement("div");
    el.className = `num ${kind}${layer ? " layer" : ""}${mine ? " me" : ""}`;
    el.textContent = kind === "miss" ? "miss" : kind === "dodged" ? "dodged" : kind === "blocked" ? `0${layer ? ` ${layer.toUpperCase()}` : ""}` : `${kind === "crit" ? "!" : ""}-${amount}${layer ? ` ${layer.toUpperCase()}` : ""}`;
    el.style.setProperty("--jx", `${(Math.random() - 0.5) * 24}px`);
    this.layer.append(el);
    this.numbers.push({ el, x, y, born: performance.now(), life: kind === "crit" ? 1300 : 950, rise: kind === "crit" ? 46 : 32 });
  }

  /** A heavy blow is coming for you: the screen's edge pulses red until it lands (`seconds`). */
  warn(seconds: number) {
    document.body.classList.remove("incoming");
    void document.body.offsetWidth;
    document.body.classList.add("incoming");
    window.clearTimeout(this.warnTimer);
    this.warnTimer = window.setTimeout(() => document.body.classList.remove("incoming"), seconds * 1000);
  }
  private warnTimer = 0;

  /** You were hit: the screen's edge flushes red, brightest on the side the blow came from. */
  hurt(angle: number | null, heavy: boolean) {
    const el = document.getElementById("hurt");
    if (!el) return;
    el.style.setProperty("--a", `${angle === null ? 0 : (angle * 180) / Math.PI + 90}deg`);
    el.className = `show${angle === null ? "" : " aimed"}${heavy ? " heavy" : ""}`;
    clearTimeout(this.hurtTimer);
    this.hurtTimer = window.setTimeout(() => (el.className = ""), 420);
  }

  /** Each frame: start the next letter popup when its turn comes, and move numbers with the world. */
  frame(now: number) {
    if (this.queue.length && now >= this.busyUntil) {
      this.pop(this.queue.shift()!);
      this.busyUntil = now + 700;
    }
    this.numbers = this.numbers.filter((n) => {
      const age = (now - n.born) / n.life;
      if (age >= 1) { n.el.remove(); return false; }
      const p = this.toScreen(n.x, n.y);
      n.el.style.transform = `translate(calc(-50% + var(--jx, 0px)), ${-n.rise * Math.sqrt(age) - 30}px) scale(${age < 0.12 ? 0.6 + age * 4 : 1})`;
      n.el.style.left = `${p.x}px`;
      n.el.style.top = `${p.y}px`;
      n.el.style.opacity = String(age > 0.7 ? (1 - age) / 0.3 : 1);
      return true;
    });
  }
}
