import Phaser from "phaser";
import { dictionary } from "./data.js";
import { describe } from "./summary.js";

/** Placeholder screen: type a word, see what the dictionary knows about it. */
class Boot extends Phaser.Scene {
  private typed = "";
  private line!: Phaser.GameObjects.Text;

  create() {
    const style = { fontFamily: "monospace", color: "#e8e6df" };
    this.add.text(24, 24, "LAST WORD", { ...style, fontSize: "32px" });
    this.add.text(24, 68, `${dictionary.size} words loaded. Type one.`, { ...style, fontSize: "16px" });
    this.line = this.add.text(24, 110, "> ", { ...style, fontSize: "20px", color: "#ffd166" });
    // Phaser's own keyboard events repeat while a key is held; the browser's are one per press.
    window.addEventListener("keydown", (e) => {
      if (e.repeat || e.ctrlKey || e.metaKey) return;
      if (e.key === "Backspace") this.typed = this.typed.slice(0, -1);
      else if (/^[a-zA-Z]$/.test(e.key)) this.typed += e.key.toLowerCase();
      this.line.setText(this.typed ? `> ${describe(dictionary, this.typed)}` : "> ");
    });
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#14161a",
  scale: { mode: Phaser.Scale.RESIZE },
  scene: Boot,
});
