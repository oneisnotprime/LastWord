import "@fontsource/kalam/400.css";
import "@fontsource/kalam/700.css";
import "@fontsource/fredoka/500.css";
import "@fontsource/fredoka/600.css";
import Phaser from "phaser";
import { stampTerrain, Tile, tileAt, TILE_METERS, type WorldMap, generateMap } from "@lastword/shared";
import { lookOf, type Look } from "./art/look.js";
import { CHUNK } from "./art/terrain.js";
import type { FromWorker, ToWorker } from "./art/terrain.worker.js";
import { dictionary } from "./data.js";
import { Hud } from "./hud.js";
import { connect, type Connection } from "./net.js";
import { Painter, PX, useMade, useStandee, ZOOM } from "./paint.js";
import { Sky } from "./sky.js";
import { Zones } from "./zones.js";

/** Device pixels per CSS pixel the game draws at (sharp on high-density screens, capped for speed). */
const DPR = Math.min(2, Math.max(1, window.devicePixelRatio || 1));

/** A label with how many it is: WOLF, or ANT ×1,000 for a swarm. */
function counted(name: string, count: number | undefined): string {
  const n = count ?? 1;
  return n > 1 ? `${name.toUpperCase()} ×${n.toLocaleString("en-US")}` : name.toUpperCase();
}

/** Ink for a name tag: you, other people, yours, someone else's, nobody's. */
const TAG_INK = { me: "#2f5a8e", person: "#a33a3a", mine: "#2f6a3a", theirs: "#8a4a1a", wild: "#4a3f33" };
/** Paper for other people, picked by name. */
const PEOPLE = ["#a85a8a", "#c9773a", "#5f8a4a", "#8a5ac9", "#b5554a", "#3f8a8a"];

/** Everything drawn for one player, creature or thing. */
interface View {
  body: Phaser.GameObjects.Image;
  tag: Phaser.GameObjects.Image;
  bar: Phaser.GameObjects.Rectangle;
  barBack: Phaser.GameObjects.Rectangle;
  flames: Phaser.GameObjects.Image[];
  badges: Phaser.GameObjects.Image[];
  ring?: Phaser.GameObjects.Image;
  look?: Look;
  /** What it was last drawn as, to redraw only on change. */
  drawn: string; tagged: string; badged: string;
  top: number; half: number; flies: boolean; living: boolean;
  spots: [number, number][];
  x: number; y: number; facing: 1 | -1; phase: number; moving: number;
}

class World extends Phaser.Scene {
  private net!: Connection;
  private map!: WorldMap;
  private hud!: Hud;
  private paint!: Painter;
  private sky!: Sky;
  private zoneView!: Zones;
  private views = new Map<string, View>();
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
  private chunks = new Map<string, { img: Phaser.GameObjects.Image; tex: Phaser.Textures.CanvasTexture; cx: number; cy: number; ticket: number }>();
  private chunkMs: number[] = [];
  private painter!: Worker;
  /** Chunk textures no longer in view, kept to reuse: textures are never destroyed mid-game. */
  private made = 0;
  private spare: { img: Phaser.GameObjects.Image; tex: Phaser.Textures.CanvasTexture }[] = [];
  private ticket = 0;
  /** Chunks asked of the worker and not back yet. */
  private pending = 0;

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
    await Promise.all(["700 13px Kalam", "400 13px Kalam", "600 9px Fredoka", "500 13px Fredoka"].map((f) => document.fonts.load(f).catch(() => [])));
    this.paint = new Painter(this, dictionary, DPR);
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
    this.sky = new Sky(this, this.paint, dictionary);
    this.zoneView = new Zones(this, this.paint, dictionary);
    this.cameras.main.setZoom(ZOOM * DPR).setBounds(0, 0, this.map.size * PX, this.map.size * PX).setBackgroundColor("#4d7b8c");
    const me = this.net.state.players.get(this.net.sessionId);
    if (me) this.cameras.main.centerOn(me.x * PX, me.y * PX);
    this.startPainter();
    this.updateChunks();
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
    (window as any).__lw = { net: this.net, map: this.map, dictionary, scene: this, PX, game: this.game, chunkMs: this.chunkMs }; // for browser checks
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
    // A paper pin stuck in the map.
    const ring = this.add.image(0, 0, "__WHITE");
    useMade(ring, this.paint.ring(14), DPR);
    ring.setTint(0x2f8aa8);
    const g = this.add.graphics();
    g.fillStyle(0x3a2a1e, 0.3).fillEllipse(1.5, 1, 4, 2);
    g.lineStyle(1.2, 0x6b4a2e, 1).lineBetween(0, 0, 3, -9);
    g.fillStyle(0xfbf7ec, 1).fillCircle(3, -10, 3.2);
    g.fillStyle(0x2f8aa8, 1).fillCircle(3, -10, 2.4);
    this.aimMark = this.add.container(x * PX, y * PX, [ring, g]).setDepth(12000);
    this.tweens.add({ targets: ring, scale: ring.scale * 1.15, duration: 600, yoyo: true, repeat: -1 });
    this.net.pick({ x, y });
    this.hud.toast("Spot marked: area events will land here", "good");
  }

  // -------------------------------------------------------------------------------------------
  // Terrain in chunks: drawn once, again only where words change the land.

  private terrainRes() {
    return Math.round(PX * ZOOM * DPR);
  }

  /** Starts the worker that draws terrain, and sends it the map. */
  private startPainter() {
    this.painter = new Worker(new URL("./art/terrain.worker.ts", import.meta.url), { type: "module" });
    this.painter.onmessage = (e: MessageEvent<FromWorker>) => {
      this.pending--;
      const c = this.chunks.get(`${e.data.cx},${e.data.cy}`);
      this.chunkMs.push(Math.round(e.data.ms));
      // A chunk forgotten or asked for again since: drop this copy.
      if (!c || c.ticket !== e.data.ticket) { e.data.bitmap.close(); return; }
      c.tex.context.clearRect(0, 0, c.tex.width, c.tex.height);
      c.tex.context.drawImage(e.data.bitmap, 0, 0);
      e.data.bitmap.close();
      c.tex.refresh();
      c.img.setVisible(true);
    };
    this.sendMap();
  }

  private sendMap() {
    this.painter.postMessage({ type: "map", size: this.map.size, tiles: this.map.tiles.slice() } satisfies ToWorker);
  }

  private drawChunk(cx: number, cy: number) {
    const key = `${cx},${cy}`;
    let c = this.chunks.get(key);
    const T = this.terrainRes(), size = CHUNK * T;
    if (!c) {
      const reuse = this.spare.pop();
      const tex = reuse?.tex ?? this.textures.createCanvas(`terrain${++this.made}`, size, size)!;
      const img = reuse?.img ?? this.add.image(0, 0, tex).setOrigin(0).setScale((CHUNK * PX + 1) / size).setDepth(0);
      // A hair larger than a chunk, so neighbours overlap and no seam shows between them.
      img.setPosition(cx * CHUNK * PX - 0.5, cy * CHUNK * PX - 0.5).setVisible(false);
      c = { img, tex, cx, cy, ticket: 0 };
      this.chunks.set(key, c);
    }
    c.ticket = ++this.ticket;
    this.pending++;
    this.painter.postMessage({ type: "chunk", cx, cy, T, ticket: c.ticket } satisfies ToWorker);
  }

  /** Asks for chunks coming into view (and a ring around it); forgets far ones. */
  private updateChunks() {
    const cam = this.cameras.main, span = CHUNK * PX, last = Math.ceil(this.map.size / CHUNK) - 1;
    const w = cam.width / cam.zoom, h = cam.height / cam.zoom, mx = cam.scrollX + cam.width / 2, my = cam.scrollY + cam.height / 2;
    const x0 = Math.max(0, Math.floor((mx - w / 2) / span) - 1), x1 = Math.min(last, Math.floor((mx + w / 2) / span) + 1);
    const y0 = Math.max(0, Math.floor((my - h / 2) / span) - 1), y1 = Math.min(last, Math.floor((my + h / 2) / span) + 1);
    if (this.pending < 4) {
      // Nearest the middle first.
      const want: [number, number, number][] = [];
      for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) if (!this.chunks.has(`${cx},${cy}`)) want.push([Math.hypot((cx + 0.5) * span - mx, (cy + 0.5) * span - my), cx, cy]);
      want.sort((a, b) => a[0] - b[0]);
      for (const [, cx, cy] of want.slice(0, 6)) this.drawChunk(cx, cy);
    }
    if (this.chunks.size > 36) {
      for (const [key, c] of this.chunks) {
        if (c.cx < x0 - 2 || c.cx > x1 + 2 || c.cy < y0 - 2 || c.cy > y1 + 2) {
          c.img.setVisible(false); c.ticket = -1; this.spare.push({ img: c.img, tex: c.tex }); this.chunks.delete(key);
        }
      }
    }
  }

  /** Redraws the chunks a stamp touched, with room for the torn edges and shadows around it. */
  private redrawAround(x: number, y: number, r: number) {
    const pad = r + 4;
    for (const c of this.chunks.values()) {
      const left = c.cx * CHUNK, top = c.cy * CHUNK;
      if (x + pad >= left && x - pad <= left + CHUNK && y + pad >= top && y - pad <= top + CHUNK) this.drawChunk(c.cx, c.cy);
    }
  }

  // -------------------------------------------------------------------------------------------
  // Standees

  private view(id: string): View {
    let v = this.views.get(id);
    if (!v) {
      v = {
        body: this.add.image(0, 0, "__WHITE"),
        tag: this.add.image(0, 0, "__WHITE").setDepth(10000),
        barBack: this.add.rectangle(0, 0, 16, 3, 0xfbf7ec).setStrokeStyle(0.5, 0x8a7a60).setOrigin(0, 0.5).setDepth(10001).setVisible(false),
        bar: this.add.rectangle(0, 0, 16, 2, 0x7fbf6a).setOrigin(0, 0.5).setDepth(10002).setVisible(false),
        flames: [], badges: [], drawn: "", tagged: "", badged: "", top: 20, half: 8, flies: false, living: false, spots: [],
        x: NaN, y: NaN, facing: 1, phase: Math.random() * 10, moving: 0,
      };
      this.views.set(id, v);
    }
    return v;
  }

  /** Redraws a standee when what it is changes: its look, what it holds, its statuses. */
  private dress(v: View, look: Look, held: string | undefined, statuses: string[], ride?: string) {
    const shrink = statuses.includes("shrink");
    const key = `${look.noun}|${look.colour}|${look.scale}|${look.count}|${held ?? ""}|${ride ?? ""}|${statuses.includes("burn")}|${shrink}|${look.burning}|${look.frozen}|${look.invisible}`;
    if (key !== v.drawn) {
      v.drawn = key;
      const shown: Look = shrink ? { ...look, scale: look.scale * 0.55 } : look;
      const st = this.paint.standee(shown, held, ride);
      useStandee(v.body, st);
      v.top = st.top; v.half = st.half; v.flies = st.flies; v.living = st.living;
      // Flames go on the body when it burns, and on the tip of a burning thing it holds.
      v.spots = look.burning || statuses.includes("burn") ? st.flames : [];
      if (held && st.tip && lookOf(dictionary, held).burning) v.spots = [...v.spots, st.tip, [st.tip[0] - 3, st.tip[1] + 7]];
      v.look = shown;
    }
    // Flames for a burning thing or a BURN status.
    const want = v.spots.length;
    while (v.flames.length < want) {
      const i = v.flames.length;
      const f = this.add.image(0, 0, "__WHITE");
      useMade(f, this.paint.flame(Math.round(14 + Math.min(16, v.half * 0.4) + (i % 2) * 5), i % 3), DPR);
      f.setData("s", f.scaleX);
      v.flames.push(f);
    }
    while (v.flames.length > want) v.flames.pop()!.destroy();
    // Frozen by a status: an icy tint.
    if (statuses.includes("freeze")) v.body.setTint(0xb8e2f8); else v.body.clearTint();
    const alpha = look.invisible ? 0.5 : look.hidden ? 0.75 : 1;
    v.body.setAlpha(alpha);
    // Badges.
    const badged = statuses.join(" ");
    if (badged !== v.badged) {
      v.badged = badged;
      v.badges.forEach((b) => b.destroy());
      v.badges = statuses.map((s) => {
        const b = this.add.image(0, 0, "__WHITE").setDepth(10003);
        useMade(b, this.paint.badge(s), DPR);
        return b;
      });
    }
  }

  private label(v: View, lines: string[], ink: string) {
    const key = `${ink}|${lines.join("\n")}`;
    if (key === v.tagged) return;
    v.tagged = key;
    useMade(v.tag, this.paint.tag(lines, ink, 12), DPR);
  }

  /** Places a view's pieces each frame: sway, bob, flames, tag, bar, badges, ring. */
  private place(v: View, id: string, time: number, hp: number, showBar: boolean) {
    const t = time / 1000;
    const bob = v.flies ? Math.sin(t * 2 + v.phase) * 1.5 : v.moving > 0 ? -Math.abs(Math.sin(t * 12 + v.phase)) * 1.2 : 0;
    v.body.setPosition(v.x, v.y + bob).setDepth(100 + v.y + (v.flies ? 40 : 0)).setFlipX(v.facing < 0);
    v.body.setRotation(v.living ? Math.sin(t * 1.6 + v.phase) * 0.03 + (v.moving > 0 ? Math.sin(t * 12 + v.phase) * 0.05 : 0) : 0);
    v.flames.forEach((f, i) => {
      const [fx, fy] = v.spots[i]!;
      f.setPosition(v.x + fx * 0.5 * v.facing, v.y + bob + fy * 0.5).setDepth(v.body.depth + 0.5);
      const flick = 1 + Math.sin(t * 9 + i * 2.1 + v.phase) * 0.14, base = f.getData("s") as number;
      f.setScale(base * (0.92 + Math.sin(t * 6 + i) * 0.08), base * flick);
      f.setRotation(Math.sin(t * 4 + i * 1.7) * 0.12);
    });
    const tagY = v.y + 7 + (v.flies ? 2 : 0);
    v.tag.setPosition(v.x, tagY + v.tag.displayHeight / 2 - 3);
    const barW = 18;
    v.barBack.setVisible(showBar).setPosition(v.x - barW / 2, v.y - v.top * 0.5 - 5).setSize(barW, 3);
    v.bar.setVisible(showBar).setPosition(v.x - barW / 2 + 0.5, v.y - v.top * 0.5 - 5).setSize((barW - 1) * Math.max(0, hp) / 100, 2)
      .setFillStyle(hp > 50 ? 0x7fbf6a : hp > 25 ? 0xe9b949 : 0xd9573b);
    let bx = v.x - (v.badges.reduce((n, b) => n + b.displayWidth, 0)) / 2;
    for (const b of v.badges) {
      b.setPosition(bx + b.displayWidth / 2, v.y - v.top * 0.5 - (showBar ? 12 : 7));
      bx += b.displayWidth;
    }
    const ringed = id === this.foe || id === this.picked;
    if (ringed) {
      if (!v.ring) { v.ring = this.add.image(0, 0, "__WHITE"); useMade(v.ring, this.paint.ring(Math.max(10, Math.min(40, v.half + 6))), DPR); }
      v.ring.setPosition(v.x, v.y).setDepth(v.body.depth - 0.5).setTint(id === this.picked ? 0x2f8aa8 : 0xd9573b).setAlpha(0.75 + Math.sin(t * 6) * 0.25);
    } else if (v.ring) { v.ring.destroy(); v.ring = undefined; }
  }

  private drop(id: string, v: View) {
    v.body.destroy(); v.tag.destroy(); v.bar.destroy(); v.barBack.destroy(); v.ring?.destroy();
    v.flames.forEach((f) => f.destroy()); v.badges.forEach((b) => b.destroy());
    this.views.delete(id);
  }

  /** Tags that would overlap slide down under each other, nearest the top first. */
  private unstackTags() {
    const tags = [...this.views.values()].map((v) => v.tag).sort((a, b) => a.y - b.y);
    const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
    for (const t of tags) {
      const w = t.displayWidth * 0.86, h = t.displayHeight * 0.62;
      let y = t.y;
      for (let pass = 0; pass < 8; pass++) {
        const hit = placed.find((r) => t.x + w / 2 > r.x0 && t.x - w / 2 < r.x1 && y + h / 2 > r.y0 && y - h / 2 < r.y1);
        if (!hit) break;
        y = hit.y1 + h / 2;
      }
      t.y = y;
      placed.push({ x0: t.x - w / 2, x1: t.x + w / 2, y0: y - h / 2, y1: y + h / 2 });
    }
  }

  /** The first thing a person carries in a slot: "held" in the hand, "ride" under them. */
  private slotOf(gear: string, slot: string): string | undefined {
    if (!gear) return undefined;
    for (const g of gear.split(",").map((s) => s.trim()).filter(Boolean)) {
      const look = lookOf(dictionary, g);
      const set = dictionary.word(look.noun)?.set;
      if (slot === "ride" ? set?.mountable === true : set?.equip_slot === slot && set?.mountable !== true) return g;
    }
    return undefined;
  }

  update(time: number, delta: number) {
    if (!this.net || !this.map) return;
    const state = this.net.state, mine = this.net.sessionId;
    const live = new Set<string>();

    // Terrain that words have laid down since we last looked: redraw only the chunks it touched.
    if (state.edits.length > this.editsApplied) {
      const stamps: { x: number; y: number; radius: number }[] = [];
      for (; this.editsApplied < state.edits.length; this.editsApplied++) {
        const e = state.edits[this.editsApplied];
        stampTerrain(this.map, { x: e.x, y: e.y, radius: e.radius, tile: e.tile });
        stamps.push(e);
      }
      this.sendMap();
      for (const e of stamps) this.redrawAround(e.x, e.y, e.radius);
    }
    this.updateChunks();

    const overMap = this.zoneView.update(state.zones, time);

    const k = Math.min(1, delta / 100);
    state.things.forEach((t: any, id: string) => {
      live.add(id);
      const v = this.view(id);
      const look = lookOf(dictionary, t.phrase, t.count);
      this.dress(v, look, undefined, []);
      this.label(v, [counted(t.phrase, t.count)], t.owner === mine ? TAG_INK.mine : t.owner ? TAG_INK.theirs : TAG_INK.wild);
      v.x = t.x * PX; v.y = t.y * PX;
      this.place(v, id, time, t.hp, t.hp < 100);
    });
    state.players.forEach((p: any, id: string) => {
      live.add(id);
      const v = this.view(id);
      const creature = p.owner !== "";
      const statuses: string[] = p.status ? p.status.split(" ").filter(Boolean) : [];
      if (creature) {
        this.dress(v, lookOf(dictionary, p.name, p.count), undefined, statuses);
        this.label(v, [counted(p.name, p.count)], p.owner === mine ? TAG_INK.mine : p.owner === "-" ? TAG_INK.wild : TAG_INK.theirs);
      } else {
        const colour = id === mine ? "#3f6fa8" : PEOPLE[[...String(p.name)].reduce((n, c) => n + c.charCodeAt(0), 0) % PEOPLE.length]!;
        this.dress(v, { ...lookOf(dictionary, "human"), colour }, this.slotOf(p.gear, "held"), statuses, this.slotOf(p.gear, "ride"));
        this.label(v, p.gear ? [String(p.name).toUpperCase(), `+ ${p.gear}`] : [String(p.name).toUpperCase()], id === mine ? TAG_INK.me : TAG_INK.person);
      }
      // Ease toward the server's position so ten updates a second look smooth.
      const tx = p.x * PX, ty = p.y * PX;
      if (Number.isNaN(v.x)) { v.x = tx; v.y = ty; }
      const dx = tx - v.x, dy = ty - v.y;
      if (Math.abs(dx) > 0.15) v.facing = dx > 0 ? 1 : -1;
      v.moving = Math.hypot(dx, dy) > 0.3 ? 0.3 : Math.max(0, v.moving - delta / 1000);
      v.x += dx * k; v.y += dy * k;
      this.place(v, id, time, p.hp, true);
      if (id === mine) this.cameras.main.centerOn(v.x, v.y);
    });
    for (const [id, v] of this.views) if (!live.has(id)) this.drop(id, v);
    this.unstackTags();

    // Light at night: fires, burning and glowing things, and a lantern for you.
    const lights: { x: number; y: number; r: number; warm: boolean }[] = [];
    for (const z of this.zoneView.lights()) lights.push(z);
    for (const [id, v] of this.views) {
      if (id === mine) lights.push({ x: v.x, y: v.y - 8, r: 3.2 * PX, warm: true });
      else if (v.flames.length || v.look?.glows) lights.push({ x: v.x, y: v.y - 8, r: 2.6 * PX, warm: true });
    }
    this.sky.update(state.daylight, state.weather, overMap, lights, time, delta);

    const me = state.players.get(mine);
    if (!me) {
      if (this.over) this.hud.status("Knocked out");
      return;
    }
    const keys = this.keys, typing = this.hud.typing;
    const dx = typing ? 0 : Number(keys.right.isDown || keys.d.isDown) - Number(keys.left.isDown || keys.a.isDown);
    const dy = typing ? 0 : Number(keys.down.isDown || keys.s.isDown) - Number(keys.up.isDown || keys.w.isDown);
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
      `${state.daylight === "night" ? " · night" : ""}${state.weather ? ` · ${state.weather}` : ""}`,
    );
    this.hud.overMap(overMap);
  }
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#4d7b8c",
  width: window.innerWidth * DPR,
  height: window.innerHeight * DPR,
  scale: { mode: Phaser.Scale.NONE, zoom: 1 / DPR },
  render: { antialias: true, roundPixels: false },
  scene: World,
});
window.addEventListener("resize", () => game.scale.resize(window.innerWidth * DPR, window.innerHeight * DPR));
