import { missing, type Letters } from "@lastword/shared";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** The overlay drawn in HTML on top of the game: status, letters held, spelling box. */
export class Hud {
  private held: Letters = {};
  private readonly input = $<HTMLInputElement>("spell");
  private toastTimer = 0;

  constructor(onSpell: (text: string) => void) {
    window.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && document.activeElement !== this.input) {
        this.input.focus();
        e.preventDefault();
      }
    });
    this.input.addEventListener("keydown", (e) => {
      e.stopPropagation(); // typing must not walk the player
      if (e.key === "Enter" && this.input.value.trim()) {
        onSpell(this.input.value);
        this.input.value = "";
        this.drawLetters();
      } else if (e.key === "Escape" || e.key === "Enter") {
        this.input.blur();
      }
    });
    this.input.addEventListener("input", () => this.drawLetters());
  }

  /** True while the player is typing a spelling. */
  get typing(): boolean {
    return document.activeElement === this.input;
  }

  status(text: string) {
    $("status").textContent = text;
  }

  setLetters(held: Letters) {
    this.held = held;
    this.drawLetters();
  }

  /** Tints the whole view for the time of day and the weather. */
  sky(daylight: string, weather: string) {
    const tint: Record<string, string> = {
      rain: "rgba(60, 80, 110, 0.25)", storm: "rgba(20, 25, 45, 0.45)", fog: "rgba(225, 228, 232, 0.6)",
      snow: "rgba(240, 245, 250, 0.3)",
    };
    $("sky").style.backgroundColor = tint[weather] ?? (daylight === "night" ? "rgba(8, 12, 40, 0.55)" : "transparent");
  }

  /** A message that stays up: death or victory. */
  banner(text: string) {
    const el = $("banner");
    el.textContent = text;
    el.className = "show";
  }

  toast(text: string, kind: "good" | "bad") {
    const el = $("toast");
    el.textContent = text;
    el.className = `show ${kind}`;
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (el.className = ""), 2500);
  }

  /** One tile per letter held; tiles the current spelling would use are lit, shortfalls in red. */
  private drawLetters() {
    const typed = this.input.value.toLowerCase().replace(/[^a-z]/g, "");
    const need: Letters = {};
    for (const ch of typed) need[ch] = (need[ch] ?? 0) + 1;
    const short = new Set(missing(this.held, typed));
    const letters = new Set([...Object.keys(this.held).filter((ch) => this.held[ch]! > 0), ...short]);
    $("letters").replaceChildren(
      ...[...letters].sort().map((ch) => {
        const tile = document.createElement("div");
        tile.className = `tile${short.has(ch) ? " short" : need[ch] ? " used" : ""}`;
        tile.innerHTML = `${ch.toUpperCase()}<small>${this.held[ch] ?? 0}</small>`;
        return tile;
      }),
    );
  }
}
