import Phaser from "phaser";
import { generateMap, Tile, tileAt, TILE_METERS, type WorldMap } from "@lastword/shared";
import { dictionary } from "./data.js";
import { Hud } from "./hud.js";
import { connect, type Connection } from "./net.js";

/** Screen pixels per map tile before camera zoom. */
const PX = 16;
const COLOURS: Record<Tile, number> = {
  [Tile.DeepWater]: 0x1f4e79, [Tile.Water]: 0x2f79b5, [Tile.Sand]: 0xd9c98a, [Tile.Grass]: 0x6aa84f,
  [Tile.Forest]: 0x2f6b3a, [Tile.Hill]: 0x8d8f5a, [Tile.Mountain]: 0x77706a, [Tile.Road]: 0xb59b6b,
  [Tile.City]: 0xa9a39a,
};

interface Marker { box: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }

class World extends Phaser.Scene {
  private net!: Connection;
  private map!: WorldMap;
  private hud!: Hud;
  private markers = new Map<string, Marker>();
  private keys!: Record<"up" | "down" | "left" | "right" | "w" | "a" | "s" | "d", Phaser.Input.Keyboard.Key>;
  private steering = false;
  private lastSteer = 0;

  async create() {
    this.hud = new Hud((text) => this.net?.spell(text));
    try {
      this.net = await connect({
        letters: (held) => this.hud.setLetters(held),
        spelled: (phrase) => this.hud.toast(`${phrase.toUpperCase()} made`, "good"),
        refused: (reason) => this.hud.toast(reason, "bad"),
        closed: () => this.hud.status("Disconnected"),
      });
    } catch {
      this.hud.status("Cannot reach the server");
      return;
    }
    this.map = generateMap(this.net.state.seed, this.net.state.size);
    this.drawMap();
    this.cameras.main.setZoom(2).setBounds(0, 0, this.map.size * PX, this.map.size * PX);
    // enableCapture false: the keys must still reach the spelling box.
    this.keys = this.input.keyboard!.addKeys(
      { up: "UP", down: "DOWN", left: "LEFT", right: "RIGHT", w: "W", a: "A", s: "S", d: "D" }, false,
    ) as World["keys"];
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      const at = this.cameras.main.getWorldPoint(p.x, p.y);
      this.net.move(at.x / PX, at.y / PX);
    });
    (window as any).__lw = { net: this.net, map: this.map, dictionary }; // for browser checks
  }

  /** One pixel per tile on a canvas, scaled up without smoothing. */
  private drawMap() {
    const size = this.map.size;
    const canvas = this.textures.createCanvas("map", size, size)!;
    const image = canvas.context.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      const c = COLOURS[this.map.tiles[i] as Tile];
      const shade = ((i * 2654435761) >>> 28) - 8; // slight speckle so flat areas read as terrain
      image.data.set([((c >> 16) & 255) + shade, ((c >> 8) & 255) + shade, (c & 255) + shade, 255], i * 4);
    }
    canvas.context.putImageData(image, 0, 0);
    canvas.refresh();
    this.add.image(0, 0, "map").setOrigin(0).setScale(PX);
  }

  /** `below` puts the label under the box, so a thing's name is not hidden by a player standing on it. */
  private marker(id: string, colour: number, size: number, text: string, depth: number, below = false): Marker {
    let m = this.markers.get(id);
    if (!m) {
      m = {
        box: this.add.rectangle(0, 0, size, size, colour).setStrokeStyle(1, 0x14161a).setDepth(depth),
        label: this.add.text(0, 0, text, { fontFamily: "monospace", fontSize: "8px", color: "#ffffff", stroke: "#14161a", strokeThickness: 2 })
          .setOrigin(0.5, below ? 0 : 1).setDepth(depth + 1).setResolution(4),
      };
      this.markers.set(id, m);
    }
    return m;
  }

  update(time: number, delta: number) {
    if (!this.net || !this.map) return;
    const state = this.net.state, mine = this.net.sessionId;
    const live = new Set<string>();

    state.things.forEach((t: any, id: string) => {
      live.add(id);
      const m = this.marker(id, t.owner === mine ? 0xffd166 : 0xd98c5f, 8, t.phrase.toUpperCase(), 5, true);
      m.box.setPosition(t.x * PX, t.y * PX);
      m.label.setPosition(t.x * PX, t.y * PX + 6);
    });
    state.players.forEach((p: any, id: string) => {
      live.add(id);
      const m = this.marker(id, id === mine ? 0xffffff : 0xe05a5a, 10, p.name, 10);
      // Ease toward the server's position so ten updates a second look smooth.
      const k = Math.min(1, delta / 100);
      const first = m.box.x === 0 && m.box.y === 0;
      m.box.setPosition(first ? p.x * PX : m.box.x + (p.x * PX - m.box.x) * k, first ? p.y * PX : m.box.y + (p.y * PX - m.box.y) * k);
      m.label.setPosition(m.box.x, m.box.y - 7);
      if (id === mine) this.cameras.main.centerOn(m.box.x, m.box.y);
    });
    for (const [id, m] of this.markers) {
      if (!live.has(id)) { m.box.destroy(); m.label.destroy(); this.markers.delete(id); }
    }

    const me = state.players.get(mine);
    if (!me) return;
    const k = this.keys, typing = this.hud.typing;
    const dx = typing ? 0 : Number(k.right.isDown || k.d.isDown) - Number(k.left.isDown || k.a.isDown);
    const dy = typing ? 0 : Number(k.down.isDown || k.s.isDown) - Number(k.up.isDown || k.w.isDown);
    if (dx || dy) {
      if (time - this.lastSteer > 100) { this.net.move(me.x + dx * 3, me.y + dy * 3); this.lastSteer = time; }
      this.steering = true;
    } else if (this.steering) {
      this.net.move(me.x, me.y); // stop where we are when the keys are released
      this.steering = false;
    }
    const others = state.players.size - 1;
    this.hud.status(
      `${Tile[tileAt(this.map, me.x, me.y)]} · ${Math.round(me.x * TILE_METERS)}, ${Math.round(me.y * TILE_METERS)} m · ` +
      `${others} other${others === 1 ? "" : "s"} in sight`,
    );
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#14161a",
  pixelArt: true,
  scale: { mode: Phaser.Scale.RESIZE },
  scene: World,
});
