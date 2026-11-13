import Phaser from "phaser";
import { generateMap, stampTerrain, Tile, tileAt, TILE_METERS, type WorldMap } from "@lastword/shared";
import { dictionary } from "./data.js";
import { Hud } from "./hud.js";
import { connect, type Connection } from "./net.js";

/** Screen pixels per map tile before camera zoom. */
const PX = 16;
const COLOURS: Record<Tile, number> = {
  [Tile.DeepWater]: 0x1f4e79, [Tile.Water]: 0x2f79b5, [Tile.Sand]: 0xd9c98a, [Tile.Grass]: 0x6aa84f,
  [Tile.Forest]: 0x2f6b3a, [Tile.Hill]: 0x8d8f5a, [Tile.Mountain]: 0x77706a, [Tile.Road]: 0xb59b6b,
  [Tile.City]: 0xa9a39a, [Tile.Pit]: 0x2a2622, [Tile.Snow]: 0xe8eef2, [Tile.Swamp]: 0x55663f,
  [Tile.Lava]: 0xd9541e, [Tile.Wall]: 0x5b5650,
};

/** A label with how many it is: WOLF, or ANT ×1000 for a swarm. */
function counted(name: string, count: number | undefined): string {
  const n = count ?? 1;
  return n > 1 ? `${name.toUpperCase()} ×${n.toLocaleString("en-US")}` : name.toUpperCase();
}

interface Marker { box: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; bar?: Phaser.GameObjects.Rectangle }

class World extends Phaser.Scene {
  private net!: Connection;
  private map!: WorldMap;
  private hud!: Hud;
  private markers = new Map<string, Marker>();
  private keys!: Record<"up" | "down" | "left" | "right" | "w" | "a" | "s" | "d", Phaser.Input.Keyboard.Key>;
  private steering = false;
  private lastSteer = 0;
  private foe: string | null = null;
  /** Right-click choice for events: an id, or a spot drawn as a cross. */
  private picked: string | null = null;
  private aimMark?: Phaser.GameObjects.Container;
  private over = false;
  private roundOver = false;
  private editsApplied = 0;
  private mapImage?: Phaser.GameObjects.Image;
  private zones = new Map<string, Phaser.GameObjects.Container>();

  async create() {
    this.hud = new Hud((text) => {
      // "give player2 abc" hands letters over; anything else is a spelling.
      const give = /^\s*give\s+(\S+)\s+([a-z]+)\s*$/i.exec(text);
      if (give) this.net?.give(give[1]!, give[2]!.toLowerCase());
      else this.net?.spell(text);
    }, dictionary, (index) => this.net?.drop(index), (which) => this.net?.use(which));
    window.addEventListener("keydown", (e) => {
      if (e.repeat || this.hud.typing || !this.net || this.over) return;
      const key = e.key.toLowerCase();
      if (key === "g") {
        this.net.gather();
        this.hud.toast("Gathering…", "good");
      } else if (key === "e") this.net.take();
      else if (key === "q") this.net.drop();
      else if (key === "u") this.net.use();
    });
    try {
      this.net = await connect({
        letters: (held) => this.hud.setLetters(held),
        spelled: (text) => this.hud.toast(text, "good"),
        refused: (reason) => this.hud.toast(reason, "bad"),
        gathered: (letter) => this.hud.toast(`+ ${letter.toUpperCase()}`, "good"),
        notice: (text) => this.hud.toast(text, "good"),
        dead: (killer) => { this.over = true; this.hud.banner(`You were killed by ${killer}. Your letters are theirs.\nYou can watch until the round ends.`); },
        won: () => {},
        roundover: ({ winner, seconds }) => {
          this.roundOver = true;
          const mine = winner === this.net.state.players.get(this.net.sessionId)?.name;
          const end = Date.now() + seconds * 1000;
          const tick = () => {
            const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
            this.hud.banner(`${mine ? "You are the last one alive. You win." : `${winner} wins the round.`}\nNew map in ${left} s`);
            if (left > 0) setTimeout(tick, 250);
          };
          tick();
        },
        loadout: (detail) => this.hud.setLoadout(detail),
        // When a finished round closes, start the next one on a fresh map.
        closed: () => (this.roundOver ? location.reload() : this.hud.status("Disconnected")),
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
      if (this.over || this.hud.screen) return;
      const at = this.cameras.main.getWorldPoint(p.x, p.y);
      const x = at.x / PX, y = at.y / PX;
      if (p.rightButtonDown()) return this.pickAt(x, y);
      // A click on another player or on a thing attacks it; a click anywhere else walks there and stops attacking.
      let hit: string | null = null;
      this.net.state.things.forEach((thing: any, id: string) => {
        if (Math.hypot(thing.x - x, thing.y - y) < 0.6) hit = id;
      });
      this.net.state.players.forEach((other: any, id: string) => {
        if (id !== this.net.sessionId && Math.hypot(other.x - x, other.y - y) < 0.8) hit = id;
      });
      this.foe = hit;
      this.net.attack(hit);
      if (!hit) this.net.move(x, y);
    });
    this.input.mouse?.disableContextMenu();
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !this.hud.typing && !this.hud.screen) this.pickAt(null);
    });
    (window as any).__lw = { net: this.net, map: this.map, dictionary, scene: this, PX }; // for browser checks
  }

  /** Right-click: pick out whoever or whatever is under the pointer, else that spot. Null clears. */
  private pickAt(x: number | null, y = 0) {
    this.aimMark?.destroy();
    this.aimMark = undefined;
    this.picked = null;
    if (x === null) { this.net.pick(null); return; }
    let hit: string | null = null;
    this.net.state.things.forEach((t: any, id: string) => { if (Math.hypot(t.x - x, t.y - y) < 0.6) hit = id; });
    this.net.state.players.forEach((o: any, id: string) => { if (id !== this.net.sessionId && Math.hypot(o.x - x, o.y - y) < 0.8) hit = id; });
    if (hit) {
      this.picked = hit;
      this.net.pick({ id: hit });
      this.hud.toast("Picked out: spell an event to use it on them", "good");
      return;
    }
    const g = this.add.graphics().lineStyle(2, 0x5fd3f3, 1);
    g.lineBetween(-5, -5, 5, 5).lineBetween(-5, 5, 5, -5).strokeCircle(0, 0, 8);
    this.aimMark = this.add.container(x * PX, y * PX, [g]).setDepth(20);
    this.net.pick({ x, y });
    this.hud.toast("Spot marked: area events will land here", "good");
  }

  /** One pixel per tile on a canvas, scaled up without smoothing. */
  private drawMap() {
    const size = this.map.size;
    const canvas = (this.textures.exists("map") ? this.textures.get("map") : this.textures.createCanvas("map", size, size)) as Phaser.Textures.CanvasTexture;
    const image = canvas.context.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      const c = COLOURS[this.map.tiles[i] as Tile];
      const shade = ((i * 2654435761) >>> 28) - 8; // slight speckle so flat areas read as terrain
      image.data.set([((c >> 16) & 255) + shade, ((c >> 8) & 255) + shade, (c & 255) + shade, 255], i * 4);
    }
    canvas.context.putImageData(image, 0, 0);
    canvas.refresh();
    if (!this.mapImage) this.mapImage = this.add.image(0, 0, "map").setOrigin(0).setScale(PX);
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

    // Terrain that words have laid down since we last looked.
    if (state.edits.length > this.editsApplied) {
      for (; this.editsApplied < state.edits.length; this.editsApplied++) {
        const e = state.edits[this.editsApplied];
        stampTerrain(this.map, { x: e.x, y: e.y, radius: e.radius, tile: e.tile });
      }
      this.drawMap();
    }

    // Events over an area: a translucent disc with the word on it.
    const ZONE: Record<string, number> = { fire: 0xff6a1a, war: 0xd02a2a, earthquake: 0x8a5a2b, famine: 0xd9b23a };
    const liveZones = new Set<string>();
    const overMap: string[] = [];
    state.zones.forEach((z: any, id: string) => {
      liveZones.add(id);
      if (z.radius === 0) { overMap.push(z.word.toUpperCase()); return; } // map-wide: shown in the status line
      const existing = this.zones.get(id);
      if (existing) {
        const disc = existing.list[0] as Phaser.GameObjects.Arc;
        if (Math.abs(disc.radius - z.radius * PX) > 0.5) disc.setRadius(z.radius * PX); // fire spreads
        existing.setPosition(z.x * PX, z.y * PX); // auras move with their maker
        return;
      }
      const colour = ZONE[z.word] ?? 0x9a6ad9;
      const disc = this.add.circle(0, 0, z.radius * PX, colour, 0.22).setStrokeStyle(2, colour, 0.8);
      const label = this.add.text(0, 0, z.word.toUpperCase(), { fontFamily: "monospace", fontSize: "9px", color: "#ffffff", stroke: "#14161a", strokeThickness: 2 })
        .setOrigin(0.5).setResolution(4);
      const c = this.add.container(z.x * PX, z.y * PX, [disc, label]).setDepth(3);
      this.tweens.add({ targets: disc, alpha: 0.6, duration: 700, yoyo: true, repeat: -1 });
      this.zones.set(id, c);
    });
    for (const [id, c] of this.zones) if (!liveZones.has(id)) { c.destroy(); this.zones.delete(id); }

    state.things.forEach((t: any, id: string) => {
      live.add(id);
      const m = this.marker(id, t.owner === mine ? 0xffd166 : t.owner ? 0xd98c5f : 0xb9b4a8, 8, counted(t.phrase, t.count), 5, true);
      m.label.setText(counted(t.phrase, t.count));
      m.box.setPosition(t.x * PX, t.y * PX).setStrokeStyle(id === this.foe || id === this.picked ? 2 : 1, id === this.picked ? 0x5fd3f3 : id === this.foe ? 0xffd166 : 0x14161a);
      if (t.hp < 100) {
        m.bar ??= this.add.rectangle(0, 0, 12, 2, 0xff8a80).setOrigin(0, 0.5).setDepth(6);
        m.bar.setPosition(t.x * PX - 6, t.y * PX - 6).setSize(12 * (t.hp / 100), 2);
      }
      m.label.setPosition(t.x * PX, t.y * PX + 6);
    });
    state.players.forEach((p: any, id: string) => {
      live.add(id);
      // People are white (you) or red; creatures are smaller: gold if yours, orange if another's, grey if nobody's.
      const creature = p.owner !== "";
      const colour = id === mine ? 0xffffff : !creature ? 0xe05a5a : p.owner === mine ? 0xffd166 : p.owner === "-" ? 0xb9b4a8 : 0xe08a3a;
      const m = this.marker(id, colour, creature ? 7 : 10, p.name, 10);
      m.box.setFillStyle(colour);
      // Statuses show on their own line under the name: STUN · POISON.
      const status = p.status ? `\n${p.status.toUpperCase().split(" ").join(" · ")}` : "";
      m.label.setText(`${creature ? counted(p.name, p.count) : p.gear ? `${p.name}\n${p.gear}` : p.name}${status}`).setAlign("center");
      m.box.setStrokeStyle(id === this.foe || id === this.picked ? 2 : 1, id === this.picked ? 0x5fd3f3 : id === this.foe ? 0xffd166 : 0x14161a);
      m.bar ??= this.add.rectangle(0, 0, 14, 2, 0x9be28f).setOrigin(0, 0.5).setDepth(12);
      // Ease toward the server's position so ten updates a second look smooth.
      const k = Math.min(1, delta / 100);
      const first = m.box.x === 0 && m.box.y === 0;
      m.box.setPosition(first ? p.x * PX : m.box.x + (p.x * PX - m.box.x) * k, first ? p.y * PX : m.box.y + (p.y * PX - m.box.y) * k);
      m.label.setPosition(m.box.x, m.box.y - 9);
      m.bar.setPosition(m.box.x - 7, m.box.y - 7).setSize(14 * (p.hp / 100), 2).setFillStyle(p.hp > 50 ? 0x9be28f : p.hp > 25 ? 0xffd166 : 0xff8a80);
      if (id === mine) this.cameras.main.centerOn(m.box.x, m.box.y);
    });
    for (const [id, m] of this.markers) {
      if (!live.has(id)) { m.box.destroy(); m.label.destroy(); m.bar?.destroy(); this.markers.delete(id); }
    }

    this.hud.sky(state.daylight, state.weather);
    const me = state.players.get(mine);
    if (!me) {
      if (this.over) this.hud.status("Knocked out");
      return;
    }
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
    let others = 0;
    state.players.forEach((p: any, id: string) => { if (id !== mine && p.owner === "") others++; });
    this.hud.status(
      `${Tile[tileAt(this.map, me.x, me.y)]} · ${Math.round(me.x * TILE_METERS)}, ${Math.round(me.y * TILE_METERS)} m · ` +
      `${others} other${others === 1 ? "" : "s"} in sight · health ${me.hp}%${me.gear ? ` · ${me.gear}` : ""}` +
      `${me.status ? ` · ${me.status.toUpperCase()}` : ""}` +
      `${state.daylight === "night" ? " · night" : ""}${state.weather ? ` · ${state.weather}` : ""}` +
      `${overMap.length ? ` · over the map: ${overMap.join(", ")}` : ""}`,
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
