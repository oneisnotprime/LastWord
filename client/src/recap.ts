import type { Recap, RoundRecap } from "./net.js";

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const big = (n: number) => Math.round(n).toLocaleString("en-US");
/** "BOT1's COLOSSUS", "a wild WOLF", "your own STORM". */
const whose = (who: string, what: string, me = "") =>
  who ? `${who.toUpperCase() === me.toUpperCase() ? "your own" : `${esc(who.toUpperCase())}'s`} ${esc(what)}` : `${esc(what)}`;

/** Lines the kill feed keeps, and how long each stays. */
const FEED_LINES = 4;
const FEED_MS = 7000;

/**
 * What happened, in a few words: the kill feed at the top right (kills near you or by someone you
 * see), the death recap ("Killed by BOT1's COLOSSUS · 6,000 crush" with the top sources of harm),
 * and the end-of-round recap (winner, round length, who killed most).
 */
export class RecapView {
  private readonly feedEl: HTMLElement;
  private readonly card: HTMLElement;
  private roundTimer = 0;

  constructor() {
    this.feedEl = document.createElement("div");
    this.feedEl.id = "killfeed";
    this.card = document.createElement("div");
    this.card.id = "recap";
    document.body.append(this.feedEl, this.card);
  }

  /** One kill in the feed: "BOT1 · GUN ✕ BOT4". Yours are marked. */
  feed(line: { killer: string; what: string; victim: string }, me: string) {
    const el = document.createElement("div");
    const mine = line.killer === me || line.victim === me;
    el.className = mine ? "mine" : "";
    el.innerHTML = `${line.killer ? `<b>${esc(line.killer.toUpperCase())}</b> · ` : ""}${esc(line.what)} <i>✕</i> <b>${esc(line.victim.toUpperCase())}</b>`;
    this.feedEl.prepend(el);
    while (this.feedEl.children.length > FEED_LINES) this.feedEl.lastElementChild!.remove();
    window.setTimeout(() => { el.classList.add("gone"); window.setTimeout(() => el.remove(), 600); }, FEED_MS);
  }

  /** You were knocked out: who did it, with what, and what hurt most in the last seconds. */
  death(r: Recap) {
    const top = r.top[0];
    const head = `Killed by ${whose(r.killer, r.what)}${top ? ` · ${big(top.amount)}${top.kind ? ` ${esc(top.kind)}` : ""}` : ""}`;
    const rows = r.top.map((t) => `<li><span>${whose(t.who, t.what)}</span><b>${big(t.amount)}${t.kind ? ` ${esc(t.kind)}` : ""}</b></li>`).join("");
    this.card.innerHTML = `<h3>${head}</h3>${rows ? `<ul>${rows}</ul>` : ""}<small>${r.seconds > 0 ? `in ${r.seconds} s · ` : ""}${r.alive} left</small>`;
    this.card.className = "show";
    window.setTimeout(() => { if (this.card.className === "show") this.card.className = "show dim"; }, 9000);
  }

  /** The round is over: the winner, how long it ran, who killed most, and the next map's countdown. */
  round(r: RoundRecap, mine: boolean) {
    const end = Date.now() + r.seconds * 1000;
    const length = r.clock ? `${Math.floor(r.clock / 60)}:${String(r.clock % 60).padStart(2, "0")}` : "";
    const kills = (r.kills ?? []).map((k) => `<li><span>${esc(k.name.toUpperCase())}</span><b>${k.kills} kill${k.kills === 1 ? "" : "s"}</b></li>`).join("");
    const draw = () => {
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      this.card.innerHTML = `<h3>${mine ? "YOU WIN" : `${esc(r.winner.toUpperCase())} WINS`}</h3>` +
        `${kills ? `<ul>${kills}</ul>` : ""}<small>${length ? `round ${length} · ` : ""}${r.people ? `${r.people} players · ` : ""}new map in ${left}</small>`;
      if (left > 0) this.roundTimer = window.setTimeout(draw, 250);
    };
    clearTimeout(this.roundTimer);
    this.card.className = "show round";
    draw();
  }
}
