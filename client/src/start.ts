/**
 * The start screen, shown before joining: play against bots (how many, how hard), or join
 * friends in a room with no bots. The last choice is remembered in this browser.
 */

export type Difficulty = "easy" | "normal" | "hard";

/** What the player chose: bots and difficulty for a fresh room, or none to join friends. */
export interface Choice { bots: number; difficulty: Difficulty }

const KEY = "lastword.start";
/** A game to start without asking, set just before the page reloads (a new round, a lost connection). */
const NEXT = "lastword.next";

/** The choice the current game was started with. */
let current: Choice | null = null;

/**
 * Starts a fresh game with the same choice as this one (bots and difficulty, or friends): the
 * page reloads straight into a new room, past the start screen. Others in the old room play on.
 */
export function playAgain(): void {
  try { sessionStorage.setItem(NEXT, JSON.stringify(current ?? remembered())); } catch { /* the start screen asks again */ }
  location.reload();
}

/** A choice set by `playAgain`, used once. */
function queued(): Choice | null {
  try {
    const raw = sessionStorage.getItem(NEXT);
    sessionStorage.removeItem(NEXT);
    const c = JSON.parse(raw ?? "null") as Partial<Choice> | null;
    if (c && Number.isInteger(c.bots) && ["easy", "normal", "hard"].includes(c.difficulty as string)) return c as Choice;
  } catch { /* none */ }
  return null;
}

function remembered(): Choice {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Choice> | null;
    if (c && Number.isInteger(c.bots) && ["easy", "normal", "hard"].includes(c.difficulty as string)) return c as Choice;
  } catch { /* storage blocked: use the defaults */ }
  return { bots: 7, difficulty: "normal" };
}

const CSS = `
#start { position: fixed; inset: 0; z-index: 10; display: flex; align-items: center; justify-content: center;
  background: radial-gradient(ellipse at center, rgba(77, 123, 140, .55), rgba(30, 50, 60, .85));
  font: 500 14px/1.4 'Fredoka', 'Trebuchet MS', sans-serif; color: #4a3f33; }
#start .box { position: relative; background: #fbf6ea; border-radius: 4px; padding: 26px 30px 24px; width: min(420px, 90vw); transform: rotate(-1deg);
  box-shadow: 0 0 0 7px #fffdf6, 0 3px 0 7px #d9cfb6, 0 22px 50px rgba(20, 14, 8, .55);
  background-image: repeating-linear-gradient(0deg, transparent 0 27px, rgba(150, 120, 80, .08) 27px 28px); }
#start h1 { margin: 0 0 2px; font: 700 40px/1.1 'Kalam', cursive; letter-spacing: 3px; color: #4a3f33; }
#start h1 span { display: inline-block; background: #e9b949; padding: 0 8px; border-radius: 3px; transform: rotate(2deg); box-shadow: 0 2px 0 #c9a23a; }
#start p { margin: 0 0 18px; color: #8a7a60; font: 400 17px 'Kalam', cursive; }
#start label { display: flex; justify-content: space-between; align-items: center; margin: 10px 0; padding-bottom: 6px; border-bottom: 1px dashed #d9cbb0; }
#start input, #start select { font: 700 16px 'Kalam', cursive; color: #4a3f33; background: #fffdf6; border: 0; border-radius: 3px; padding: 3px 8px; width: 110px;
  box-shadow: inset 0 1px 2px rgba(60, 40, 20, .25); }
#start button { font: 700 18px 'Kalam', cursive; width: 100%; margin-top: 12px; padding: 8px; cursor: pointer; border-radius: 3px; border: 0;
  background: #fffdf6; color: #4a3f33; letter-spacing: 1px; box-shadow: 0 2px 0 #cfc3a6, 0 5px 10px rgba(40, 28, 16, .3); }
#start button.main { background: #e9b949; color: #4a3510; box-shadow: 0 2px 0 #b8902a, 0 5px 10px rgba(40, 28, 16, .3); font-size: 22px; }
#start button:hover { transform: translateY(-1px) rotate(-0.6deg); }`;

/** Shows the start screen and resolves with the choice once the player clicks. */
export function chooseGame(): Promise<Choice> {
  const next = queued();
  if (next) return Promise.resolve((current = next));
  const last = remembered();
  const style = document.createElement("style");
  style.textContent = CSS;
  const root = document.createElement("div");
  root.id = "start";
  root.innerHTML = `<div class="box">
    <h1>LAST <span>WORD</span></h1>
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
      current = choice;
      done(choice);
    };
    root.querySelector("#start-play")!.addEventListener("click", () => {
      const n = Math.max(1, Math.min(99, Math.floor(Number(bots.value) || 7)));
      finish({ bots: n, difficulty: difficulty.value as Difficulty });
    });
    root.querySelector("#start-friends")!.addEventListener("click", () => finish({ bots: 0, difficulty: "normal" }));
  });
}
