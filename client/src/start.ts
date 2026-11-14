/**
 * The start screen, shown before joining: play against bots (how many, how hard), or join
 * friends in a room with no bots. The last choice is remembered in this browser.
 */

export type Difficulty = "easy" | "normal" | "hard";

/** What the player chose: bots and difficulty for a fresh room, or none to join friends. */
export interface Choice { bots: number; difficulty: Difficulty }

const KEY = "lastword.start";

function remembered(): Choice {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Choice> | null;
    if (c && Number.isInteger(c.bots) && ["easy", "normal", "hard"].includes(c.difficulty as string)) return c as Choice;
  } catch { /* storage blocked: use the defaults */ }
  return { bots: 7, difficulty: "normal" };
}

const CSS = `
#start { position: fixed; inset: 0; z-index: 10; display: flex; align-items: center; justify-content: center;
  background: #14161af0; font: 14px/1.4 ui-monospace, Menlo, Consolas, monospace; color: #e8e6df; }
#start .box { background: #1c1e23; border: 1px solid #55524a; border-radius: 6px; padding: 24px 28px; width: min(420px, 90vw); }
#start h1 { margin: 0 0 4px; font-size: 26px; letter-spacing: 4px; color: #ffd166; }
#start p { margin: 0 0 18px; color: #a9a79f; font-size: 12px; }
#start label { display: flex; justify-content: space-between; align-items: center; margin: 10px 0; }
#start input, #start select { font: inherit; color: #e8e6df; background: #14161a; border: 1px solid #55524a; border-radius: 3px; padding: 4px 6px; width: 110px; }
#start button { font: inherit; width: 100%; margin-top: 12px; padding: 10px; cursor: pointer; border-radius: 4px;
  border: 1px solid #55524a; background: #2a2c31; color: #e8e6df; letter-spacing: 1px; }
#start button.main { background: #ffd166; color: #26221a; border-color: #ffd166; font-weight: 700; }
#start button:hover { border-color: #ffd166; }`;

/** Shows the start screen and resolves with the choice once the player clicks. */
export function chooseGame(): Promise<Choice> {
  const last = remembered();
  const style = document.createElement("style");
  style.textContent = CSS;
  const root = document.createElement("div");
  root.id = "start";
  root.innerHTML = `<div class="box">
    <h1>LAST WORD</h1>
    <p>Spell to survive. The last one alive wins.</p>
    <label>Bots <input id="start-bots" type="number" min="1" max="99" value="${Math.max(1, last.bots)}"></label>
    <label>Difficulty <select id="start-difficulty">
      ${["easy", "normal", "hard"].map((d) => `<option value="${d}"${d === last.difficulty ? " selected" : ""}>${d}</option>`).join("")}
    </select></label>
    <button class="main" id="start-play">Play</button>
    <button id="start-friends">Join with friends (no bots)</button>
  </div>`;
  document.head.append(style);
  document.body.append(root);
  const bots = root.querySelector<HTMLInputElement>("#start-bots")!;
  const difficulty = root.querySelector<HTMLSelectElement>("#start-difficulty")!;
  // Keys typed here are not moves or spellings in the game behind.
  root.addEventListener("keydown", (e) => e.stopPropagation());
  return new Promise((done) => {
    const finish = (choice: Choice) => {
      try { localStorage.setItem(KEY, JSON.stringify(choice.bots ? choice : { ...choice, bots: last.bots })); } catch { /* not remembered */ }
      root.remove();
      style.remove();
      done(choice);
    };
    root.querySelector("#start-play")!.addEventListener("click", () => {
      const n = Math.max(1, Math.min(99, Math.floor(Number(bots.value) || 7)));
      finish({ bots: n, difficulty: difficulty.value as Difficulty });
    });
    root.querySelector("#start-friends")!.addEventListener("click", () => finish({ bots: 0, difficulty: "normal" }));
  });
}
