import "@fontsource/kalam/400.css";
import "@fontsource/kalam/700.css";
import "@fontsource/fredoka/500.css";
import "@fontsource/fredoka/600.css";
import Phaser from "phaser";
import { TRADE_RANGE, aimOf, cardOf, GATHER_REASONS, missing, parsePhrase, readDescription, SITE_RADIUS, stampTerrain, Tile, tileAt, TILE_METERS, type Card, type Phrase, type WorldMap, generateMap } from "@lastword/shared";
import { Effects } from "./fx.js";
import { playAgain } from "./start.js";
import { lookOf, type Look } from "./art/look.js";
import { CHUNK } from "./art/terrain.js";
import type { FromWorker, ToWorker } from "./art/terrain.worker.js";
import { dictionary } from "./data.js";
import { Events } from "./events.js";
import { Hud, type Aimed } from "./hud.js";
import { Minimap } from "./minimap.js";
import { pad, type Pad } from "./pad.js";
import { connect, type Connection, type Described, type Got, type Hit } from "./net.js";
import { Threats } from "./threats.js";
import { Painter, PX, useMade, useStandee, ZOOM } from "./paint.js";
import { Sky } from "./sky.js";
import { Zones } from "./zones.js";

/** The fog canvas's size, and the radius of its clear middle, in canvas pixels. */
const FOG_SIZE = 512, FOG_CLEAR = 100;

/** Device pixels per CSS pixel the game draws at (sharp on high-density screens, capped for speed). */
const DPR = Math.min(2, Math.max(1, window.devicePixelRatio || 1));

/** A label with how many it is: WOLF, or ANT ×1,000 for a swarm. */
function counted(name: string, count: number | undefined): string {
  const n = count ?? 1;
  return n > 1 ? `${name.toUpperCase()} ×${n.toLocaleString("en-US")}` : name.toUpperCase();
}

/**
 * Messages, short: "+E", "No Z", and nothing for routine success the world already shows (a
 * SWORD in your hand, a WOLF at your side). Null: say nothing.
 */
function terse(kind: "spelled" | "refused" | "notice", text: string): string | null {
  if (kind === "spelled") return /wild/.test(text) ? text.replace(/^.*?(\d+ ran wild|runs wild).*$/, "$1") : null;
  if (kind === "notice" && / (equipped|in hand|dropped)$/.test(text)) return null;
  return text.replace(/^You need /, "No ").replace(/^You cannot spell while you are /, "Cannot spell: ");
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
  /** Until when (scene time) it flashes from a blow, shakes, and shows its health bar. */
  flashUntil: number; shakeUntil: number; barUntil: number; crit: boolean;
  /** Until when it lunges toward `lungeTo` (an attack it made). */
  lungeUntil: number; lungeTo: { x: number; y: number } | null;
}

/** Why a letter came that ends a gathering action. */
const GATHERED = new Set<string>([...Object.values(GATHER_REASONS), "cache", "temple"]);
/** Seconds a health bar stays up over something hit, and a "targeting you" mark over whoever hit you. */
const BAR_SECONDS = 4;
const THREAT_SECONDS = 3;
/** Most screen space sight may fill, as a fraction of half the smaller side; the camera zooms to fit it. */
const SIGHT_FILL = 0.92;
/** Camera zoom limits (before the device pixel ratio): readable at night, not too many chunks by day. */
const MIN_ZOOM = 1.5, MAX_ZOOM = 4.5;

class World extends Phaser.Scene {
  private net!: Connection;
  private map!: WorldMap;
  private hud!: Hud;
  private paint!: Painter;
  private chips!: Events;
  private sky!: Sky;
  private zoneView!: Zones;
  private views = new Map<string, View>();
  private keys!: Record<"up" | "down" | "left" | "right" | "w" | "a" | "s" | "d", Phaser.Input.Keyboard.Key>;
  private steering = false;
  private lastSteer = 0;
  private foe: string | null = null;
  /** A spelling waiting for a click on its target: adjectives alone (`describe`), or an event. */
  private aiming: string | null = null;
  private aimHow: "describe" | "someone" | "anywhere" = "describe";
  /** What the pointer is over while aiming. */
  private hover: string | null = null;
  private over = false;
  private roundOver = false;
  /** Knocked out: the one the camera follows (your killer, then theirs), by id. */
  private watching: string | null = null;
  private myName = "";
  private minimap!: Minimap;
  /** Whether the spell window was open last frame: opening or closing it forgets held keys. */
  private wasTyping = false;
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
  private fx!: Effects;
  /** A gathering action under way: when it began and how long it takes (scene time, ms). */
  private gathering: { start: number; ms: number } | null = null;
  private gatherRing!: Phaser.GameObjects.Graphics;
  /** Lines from attacker to target for a moment after each blow. */
  private tracers: { from: string; to: string; fx?: number; fy?: number; until: number; ranged: boolean; mine: boolean }[] = [];
  private tracerGfx!: Phaser.GameObjects.Graphics;
  /** Who struck you lately, and until when they are marked as targeting you. */
  private threats = new Map<string, number>();
  /** Something nobody owns that a click asked to claim: walk to it, then take it. */
  private claiming: string | null = null;
  /** What is coming for you, from the server (arrows at the screen's edge for what is off screen). */
  private threatList = new Threats();
  /** Whether a person's gear text has them flying (riding something with air speed), by gear text. */
  private airCache = new Map<string, boolean>();
  /** What you can see, in tiles, from the loadout; the camera zooms so the screen shows that much. */
  private sightTiles = 15;
  private fog!: Phaser.GameObjects.Image;
  private lastPrompt = 0;
  /**
   * Controller: a cursor on the map (tiles) moved by the right stick or snapped to a target, the
   * target it is on, when the stick last moved it, and whether LT's inspect card is up.
   */
  private cursor: { x: number; y: number } | null = null;
  private cursorOn: string | null = null;
  private cursorMoved = 0;
  private padInspect = false;
  private reticle!: Phaser.GameObjects.Graphics;
  /** Blows shown so far, for browser checks. */
  hitCount = 0;

  async create() {
    this.hud = new Hud((text, target) => {
      // "give player2 abc" hands letters over; adjectives alone and events are aimed at a target
      // (the one the window was opened for, else the next click); anything else is a spelling.
      const give = /^\s*give\s+(\S+)\s+([a-z]+)\s*$/i.exec(text);
      if (give) return this.net?.give(give[1]!, give[2]!.toLowerCase());
      const alone = readDescription(dictionary, text);
      let phrase: Phrase | null = null;
      try { phrase = alone ? null : parsePhrase(dictionary, text); } catch { /* the server says why */ }
      const how = alone ? "describe" : phrase ? aimOf(phrase) : null;
      if (!how) return this.net?.spell(text);
      const lacking = missing(this.hud.letters, alone ? alone.letters : phrase!.letters);
      if (lacking) return this.hud.toast(`No ${lacking.toUpperCase().split("").join(" ")}`, "bad");
      const words = alone ? alone.adjectives.join(" ") : text.trim().toLowerCase();
      if (target) this.release(words, how, target.id);
      else this.startAim(words, how);
    }, dictionary, (index) => this.net?.drop(index), (which) => this.net?.use(which), (index) => {
      if (!this.aiming || this.aimHow !== "describe" || !this.net) return;
      this.net.describe(this.aiming, this.net.sessionId, index);
      this.endAim();
    }, () => { this.net?.leave(); playAgain(); });
    // Trading: what the trade screen and offer cards send, and the people near enough to trade with.
    this.hud.act = (type, payload) => this.net?.act(type, payload);
    this.hud.people = () => {
      const out: { id: string; name: string }[] = [];
      const me = this.net?.state.players.get(this.net.sessionId);
      if (!me) return out;
      this.net.state.players.forEach((p: any, id: string) => {
        if (id !== this.net.sessionId && p.owner === "" && Math.hypot(p.x - me.x, p.y - me.y) <= TRADE_RANGE) out.push({ id, name: String(p.name) });
      });
      return out;
    };
    window.addEventListener("keydown", (e) => {
      if (e.repeat || this.hud.typing || !this.net || this.over) return;
      const key = e.key.toLowerCase();
      if (key === "g") this.net.gather();
      else if (key === "e") this.net.take();
      else if (key === "r") this.net.dismount();
      else if (key === "q") this.net.drop();
      else if (key === "u") this.net.use();
    });
    await Promise.all(["700 13px Kalam", "400 13px Kalam", "600 9px Fredoka", "500 13px Fredoka"].map((f) => document.fonts.load(f).catch(() => [])));
    this.paint = new Painter(this, dictionary, DPR);
    this.chips = new Events(dictionary);
    this.fx = new Effects((x, y) => {
      const cam = this.cameras.main;
      return { x: ((x * PX - cam.worldView.x) * cam.zoom) / DPR, y: ((y * PX - cam.worldView.y) * cam.zoom) / DPR };
    });
    this.minimap = new Minimap(document.getElementById("minimap") as HTMLCanvasElement, DPR);
    try {
      this.net = await connect({
        letters: (held) => this.hud.setLetters(held),
        spelled: (text) => { const t = terse("spelled", text); if (t) this.hud.toast(t, "good"); },
        refused: (reason) => {
          const t = terse("refused", reason);
          if (t) this.hud.toast(t, "bad");
          // A gather that found nothing: a red note over you, and the ring goes.
          if (/gather|picked clean/i.test(reason)) {
            const me = this.net?.state.players.get(this.net.sessionId);
            if (me) this.fx.fail(me.x, me.y - 1.2, /picked clean/.test(reason) ? "picked clean" : "nothing here");
            this.gathering = null;
          }
        },
        gathered: () => {},
        gathering: (seconds) => { this.gathering = { start: this.time.now, ms: seconds * 1000 }; },
        got: (g) => this.onGot(g),
        missed: (m) => { this.fx.fail(m.x, m.y - 1.2, m.text, true); this.gathering = null; },
        hits: (list) => this.onHits(list),
        offers: (list) => this.hud.setOffers(list),
        threats: (list) => this.threatList.set(list),
        dropped: () => this.hud.toast("Connection lost: reconnecting…", "bad"),
        reconnected: () => this.hud.toast("Reconnected", "good"),
        notice: (text) => { const t = terse("notice", text); if (t) this.hud.toast(t, "good"); },
        dead: () => { this.over = true; this.endAim(); this.hud.lock(); this.hud.knockedOut(null); },
        watching: (who) => { this.watching = who.id; this.hud.knockedOut(who.name); },
        sensed: (what) => this.minimap.picked(what),
        won: () => {},
        roundover: ({ winner, seconds }) => {
          this.roundOver = true;
          this.endAim();
          this.hud.lock();
          const mine = winner === this.net.state.players.get(this.net.sessionId)?.name;
          const end = Date.now() + seconds * 1000;
          const tick = () => {
            const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
            this.hud.banner(`${mine ? "YOU WIN" : `${winner.toUpperCase()} WINS`}\nnew map in ${left}`);
            if (left > 0) setTimeout(tick, 250);
          };
          tick();
        },
        loadout: (detail) => {
          this.hud.setLoadout(detail); this.minimap.senses(detail);
          if (detail.sight > 0) this.sightTiles = detail.sight / TILE_METERS;
        },
        described: (e) => this.burst(e),
        // When a finished round closes, start the next one on a fresh map; a room lost for good
        // (the server restarted) starts a new game with the same choices.
        closed: () => {
          if (this.roundOver) return location.reload();
          this.hud.banner("The game server restarted\nstarting a new game…");
          window.setTimeout(playAgain, 2500);
        },
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
    this.gatherRing = this.add.graphics().setDepth(11000);
    this.tracerGfx = this.add.graphics().setDepth(11001);
    this.fog = this.makeFog();
    this.reticle = this.add.graphics().setDepth(11600);
    pad.world = (p, dt) => this.padFrame(p, dt);
    // enableCapture false: the keys must still reach the spelling box.
    this.keys = this.input.keyboard!.addKeys(
      { up: "UP", down: "DOWN", left: "LEFT", right: "RIGHT", w: "W", a: "A", s: "S", d: "D" }, false,
    ) as World["keys"];
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (this.over || this.hud.screen) return;
      const at = this.cameras.main.getWorldPoint(p.x, p.y);
      const x = at.x / PX, y = at.y / PX;
      if (this.aiming) {
        if (p.rightButtonDown()) return this.endAim(true);
        const target = this.hitAt(x, y, this.aimHow === "describe");
        if (!target && this.aimHow === "describe") return this.hud.toast("Click a thing, a creature, a person or yourself", "bad");
        if (!target && this.aimHow === "someone") return this.hud.toast("Click a person, a creature or a thing", "bad");
        return this.release(this.aiming, this.aimHow, target ?? { x, y });
      }
      if (p.rightButtonDown()) return this.inspectAt(x, y, p);
      this.hud.closeInspect();
      // A click on an area's name tag (claimed ground, a FIRE) opens what it does.
      const tagged = this.zoneView.tagAt(at.x, at.y);
      if (tagged) return this.chips.show(tagged);
      this.claiming = null;
      // A click on another player or on a thing attacks it; a click anywhere else walks there and stops attacking.
      // Your own things and creatures, and the land itself (a LAKE), are walked over, not attacked:
      // the server refuses those, and a click that did neither left you standing.
      let hit: string | null = null;
      const mine = this.net.sessionId;
      let claim: string | null = null;
      this.net.state.things.forEach((thing: any, id: string) => {
        const land = dictionary.word(lookOf(dictionary, thing.phrase).noun)?.set.tile_type;
        if (thing.owner === mine || land || Math.hypot(thing.x - x, thing.y - y) >= 0.6) return;
        // Nobody's (a RUIN, something dropped): walk over and claim it. Shift-click attacks it instead.
        if (!thing.owner && !thing.fixture?.match(/market|temple|cache/) && !(p.event as MouseEvent).shiftKey) { claim = id; hit = null; }
        else { hit = id; claim = null; }
      });
      this.net.state.players.forEach((other: any, id: string) => {
        if (id !== mine && other.owner !== mine && Math.hypot(other.x - x, other.y - y) < 0.8) { hit = id; claim = null; }
      });
      if (claim) {
        const t = this.net.state.things.get(claim);
        this.claiming = claim;
        this.foe = null;
        this.net.attack(null);
        this.net.move(t.x, t.y);
        this.gathering = null;
        return;
      }
      this.foe = hit;
      this.net.attack(hit);
      if (!hit) { this.net.move(x, y); this.gathering = null; }
    });
    this.input.mouse?.disableContextMenu();
    window.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || this.hud.typing) return;
      if (this.aiming) this.endAim(true);
      else this.hud.closeInspect();
    });
    window.addEventListener("mousemove", (e) => { if (this.aiming) this.hud.pointer(e.clientX, e.clientY); });
    // Keys held when the page loses focus never send their release: forget them, and stop.
    const forget = () => { this.input.keyboard?.resetKeys(); if (this.steering) { this.net.stop(); this.steering = false; } };
    window.addEventListener("blur", forget);
    document.addEventListener("visibilitychange", () => { if (document.hidden) forget(); });
    (window as any).__lw = { net: this.net, map: this.map, dictionary, scene: this, PX, game: this.game, chunkMs: this.chunkMs, pad }; // for browser checks
  }

  /** The player, creature or thing under a map point, by id; `self` counts you too. */
  private hitAt(x: number, y: number, self = false): string | null {
    let hit: string | null = null, best = Infinity;
    this.net.state.things.forEach((t: any, id: string) => { const d = Math.hypot(t.x - x, t.y - y); if (d < 0.7 && d < best) { hit = id; best = d; } });
    this.net.state.players.forEach((o: any, id: string) => {
      if (id === this.net.sessionId && !self) return;
      const d = Math.hypot(o.x - x, o.y - y - 0.3); // a standee stands up from its feet
      if (d < 0.9 && d < best) { hit = id; best = d; }
    });
    return hit;
  }

  /** Waits for a click on what these adjectives describe. Nothing is spent until the server agrees. */
  private startAim(words: string, how: "describe" | "someone" | "anywhere") {
    this.hud.closeInspect();
    this.aiming = words;
    this.aimHow = how;
    this.hud.aim(words, how);
    const p = this.input.activePointer;
    this.hud.pointer(p.x / DPR, p.y / DPR);
    // On a controller the cursor starts on the nearest thing the spelling can go on.
    if (pad.mode === "pad") {
      const first = this.targets(how === "describe" ? "describe" : how === "someone" ? "someone" : "any")[0];
      const me = this.net.state.players.get(this.net.sessionId);
      this.snap(first?.id ?? null, first ?? (me ? { x: me.x, y: me.y } : null));
    }
  }

  private endAim(cancelled = false) {
    if (cancelled && this.aiming) this.hud.toast(`${this.aiming.toUpperCase()} put away; nothing spent`, "good");
    this.aiming = null;
    this.hover = null;
    this.hud.aim(null);
  }

  /**
   * Adjectives landed on something: a gold burst of paper on it and a tag that rises from it
   * saying what changed (WORST on WOLF: integrity ×0.2, damage ×0.3). Seen by everyone in sight.
   */
  private burst(e: Described) {
    const v = this.views.get(e.target);
    const x = v ? v.x : e.x * PX, y = v ? v.y - v.top * 0.3 : e.y * PX;
    const ring = this.add.image(x, y, "__WHITE").setDepth(12001);
    useMade(ring, this.paint.ring(30), DPR);
    ring.setTint(0xe9b949);
    const base = ring.scaleX;
    ring.setScale(base * 0.2);
    this.tweens.add({ targets: ring, scaleX: base * 1.6, scaleY: base * 1.6, alpha: 0, duration: 900, ease: "Cubic.easeOut", onComplete: () => ring.destroy() });
    const flash = this.add.circle(x, y, 14, 0xfff3c4, 0.9).setDepth(12000);
    this.tweens.add({ targets: flash, scale: 2.4, alpha: 0, duration: 450, ease: "Quad.easeOut", onComplete: () => flash.destroy() });
    const colours = ["#e9b949", "#fbf7ec", "#d9573b", "#5f9a4a", "#2f8aa8"];
    for (let i = 0; i < 18; i++) {
      const s = this.add.image(x, y, "__WHITE").setDepth(12002);
      useMade(s, this.paint.speck(colours[i % colours.length]!, 2.4), DPR);
      const a = (i / 18) * Math.PI * 2 + Math.random() * 0.3, r = 22 + Math.random() * 22;
      this.tweens.add({ targets: s, x: x + Math.cos(a) * r, y: y + Math.sin(a) * r * 0.7 + 10, alpha: 0, angle: 180, duration: 800 + Math.random() * 400, ease: "Cubic.easeOut", onComplete: () => s.destroy() });
    }
    const label = this.add.image(x, y - 12, "__WHITE").setDepth(12003);
    useMade(label, this.paint.tag([`${e.words} on ${e.what}`, ...e.changes], "#8a5a1a", 13), DPR);
    label.setAlpha(0).setAngle(-2);
    this.tweens.add({ targets: label, y: y - 44, alpha: 1, duration: 450, ease: "Back.easeOut" });
    this.tweens.add({ targets: label, y: y - 64, alpha: 0, delay: 3400, duration: 700, onComplete: () => label.destroy() });
  }

  /**
   * Casts an aimed spelling at what was clicked: adjectives are put on it (`describe`); an event is
   * pointed at it (`pick`, an id or a spot) and spelled, then the pick is cleared, so each event
   * goes where its own click said. Nothing is spent until the server agrees.
   */
  private release(words: string, how: "describe" | "someone" | "anywhere", at: string | { x: number; y: number }) {
    this.endAim();
    if (how === "describe") return this.net.describe(words, at as string);
    this.net.pick(typeof at === "string" ? { id: at } : at);
    this.net.spell(words);
    this.net.pick(null);
    if (typeof at !== "string") this.pin(at.x, at.y);
  }

  /** A paper pin stuck in the map where an event was aimed, for a moment. */
  private pin(x: number, y: number) {
    const ring = this.add.image(0, 0, "__WHITE");
    useMade(ring, this.paint.ring(14), DPR);
    ring.setTint(0x2f8aa8);
    const g = this.add.graphics();
    g.fillStyle(0x3a2a1e, 0.3).fillEllipse(1.5, 1, 4, 2);
    g.lineStyle(1.2, 0x6b4a2e, 1).lineBetween(0, 0, 3, -9);
    g.fillStyle(0xfbf7ec, 1).fillCircle(3, -10, 3.2);
    g.fillStyle(0x2f8aa8, 1).fillCircle(3, -10, 2.4);
    const mark = this.add.container(x * PX, y * PX, [ring, g]).setDepth(12000);
    this.tweens.add({ targets: mark, alpha: 0, delay: 1200, duration: 600, onComplete: () => mark.destroy() });
  }

  /**
   * Letters gained: the popup (fx), and a gathering action that found its letter is over. A
   * hunt's food shows on the HUD with the next loadout.
   */
  private onGot(g: Got) {
    this.fx.got(g);
    if (GATHERED.has(g.why)) this.gathering = null;
  }

  /**
   * Blows where we can see them: the struck flash, shake and show their health for a while,
   * with a number; the striker lunges, and a line (a tracer for a shot) joins them for a moment.
   * A blow on you reddens the screen's edge from its side and marks who struck you.
   */
  private onHits(list: Hit[]) {
    const now = this.time.now, mine = this.net.sessionId;
    for (const h of list) {
      const target = this.views.get(h.on), attacker = this.views.get(h.by);
      if (target && h.kind !== "miss") {
        target.flashUntil = now + 160; target.shakeUntil = now + 260; target.crit = h.kind === "crit";
        target.barUntil = now + BAR_SECONDS * 1000;
      }
      if (attacker && target) { attacker.lungeUntil = now + 220; attacker.lungeTo = { x: target.x, y: target.y }; }
      const at = this.net.state.players.get(h.on) ?? this.net.state.things.get(h.on) ?? (target ? { x: target.x / PX, y: target.y / PX } : null);
      this.hitCount++;
      if (at) this.fx.number(at.x, at.y - 1.4, h.amount, h.kind, h.layer, h.on === mine);
      this.tracers.push({ from: h.by, to: h.on, ...(h.x !== undefined ? { fx: h.x, fy: h.y } : {}), until: now + (h.ranged ? 260 : 180), ranged: h.ranged, mine: h.on === mine || h.by === mine });
      if (h.on === mine && h.kind !== "miss") {
        const from = this.net.state.players.get(h.by) ?? (h.x !== undefined ? { x: h.x, y: h.y } : null), me = this.net.state.players.get(mine);
        this.fx.hurt(from && me ? Math.atan2(from.y - me.y, from.x - me.x) : null, h.kind === "crit" || h.amount >= 20);
        if (this.views.has(h.by)) this.threats.set(h.by, now + THREAT_SECONDS * 1000);
      }
    }
    if (this.tracers.length > 60) this.tracers.splice(0, this.tracers.length - 60);
  }

  /**
   * Drawn over the world each frame: the camera zoomed to what you can see with fog past it,
   * the gathering ring, attack lines, marks on whoever is attacking you, effects, and the hint
   * of what you can do where you stand.
   */
  private overlays(time: number, delta: number) {
    const cam = this.cameras.main, me = this.net.state.players.get(this.net.sessionId);
    // Zoom so the screen holds your sight, easing when it changes (night, a TELESCOPE, BLIND).
    const half = (Math.min(innerWidth, innerHeight) / 2) * SIGHT_FILL;
    const want = DPR * Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, half / (Math.max(1, this.sightTiles) * PX)));
    if (Math.abs(cam.zoom - want) > 1e-3) cam.setZoom(cam.zoom + (want - cam.zoom) * Math.min(1, delta / 350));
    // Past your sight: fog. The clear circle is your sight's radius on screen.
    const r = this.sightTiles * PX * cam.zoom;
    this.fog.setPosition(cam.width / 2, cam.height / 2).setScale((r / FOG_CLEAR) / (cam.zoom), (r / FOG_CLEAR) / cam.zoom);
    // Gathering: a ring filling round your feet over GATHER_SECONDS, with flicks of earth.
    const g = this.gatherRing.clear();
    const mv = this.views.get(this.net.sessionId);
    if (this.gathering && mv && me) {
      const p = Math.min(1, (time - this.gathering.start) / this.gathering.ms);
      const R = 20, cx = mv.x, cy = mv.y + 1;
      g.fillStyle(0x3a2a1e, 0.3).fillEllipse(cx, cy, R * 2.3, R * 1.15);
      g.lineStyle(6, 0xfbf6ea, 0.95).strokeEllipse(cx, cy, R * 2, R);
      g.lineStyle(4.5, 0xe9b949, 1).beginPath();
      for (let i = 0; i <= 40 * p; i++) {
        const a = -Math.PI / 2 + (i / 40) * Math.PI * 2;
        const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R * 0.5;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.strokePath();
      for (let i = 0; i < 3; i++) {
        const k = ((time / 380 + i / 3) % 1), a = i * 2.1 + time / 900;
        g.fillStyle(0x7a5a3a, 1 - k).fillCircle(cx + Math.cos(a) * 10 * k, cy - 18 * Math.sin(k * Math.PI), 2);
      }
      if (time - this.gathering.start > this.gathering.ms + 1500) this.gathering = null; // the server never answered
    }
    // Attack lines: a quick ink stroke for a swing, a bright tracer for a shot.
    const t = this.tracerGfx.clear();
    this.tracers = this.tracers.filter((tr) => tr.until > time);
    for (const tr of this.tracers) {
      const a = this.views.get(tr.from), b = this.views.get(tr.to);
      const from = a ? { x: a.x, y: a.y - a.top * 0.3 } : tr.fx !== undefined ? { x: tr.fx * PX, y: tr.fy! * PX } : null;
      if (!from || !b) continue;
      const to = { x: b.x, y: b.y - b.top * 0.3 }, k = (tr.until - time) / (tr.ranged ? 260 : 180);
      if (tr.ranged) {
        const head = 1 - k, tail = Math.max(0, head - 0.35);
        t.lineStyle(2.2, tr.mine ? 0xffe27a : 0xfff3c4, 0.95).lineBetween(from.x + (to.x - from.x) * tail, from.y + (to.y - from.y) * tail, from.x + (to.x - from.x) * head, from.y + (to.y - from.y) * head);
      } else {
        t.lineStyle(1.6, tr.mine ? 0xd9573b : 0x4a3f33, 0.55 * k).lineBetween(from.x, from.y, to.x, to.y);
        const ang = Math.atan2(to.y - from.y, to.x - from.x);
        t.lineStyle(2.4, 0xfbf6ea, 0.9 * k).beginPath().arc(to.x, to.y, 9, ang + Math.PI - 0.9, ang + Math.PI + 0.9).strokePath();
      }
    }
    // Aircraft: a shadow on the ground below and speed streaks behind, so a PLANE is seen coming.
    for (const [id, p] of this.net.state.players as Map<string, { gear: string; x: number; y: number }>) {
      const v = this.views.get(id);
      if (!v || !this.airborne(p.gear)) continue;
      const lift = 22 + Math.sin(time / 300 + v.phase) * 2;
      t.fillStyle(0x2b2a28, 0.22).fillEllipse(v.x + 10, v.y + lift, Math.max(18, v.half * 1.6), Math.max(6, v.half * 0.5));
      if (v.moving > 0) for (let i = 0; i < 3; i++) {
        const y = v.y - v.top * 0.3 + (i - 1) * 5, len = 14 + ((time / 40 + i * 7) % 10);
        t.lineStyle(1.4, 0xfbf6ea, 0.7).lineBetween(v.x - v.facing * (v.half + 4), y, v.x - v.facing * (v.half + 4 + len), y);
      }
    }
    // What is aimed at you and in sight is marked like a blow taken; what is not gets an edge arrow.
    for (const th of this.threatList.all) if (th.targeting && this.views.has(th.id)) this.threats.set(th.id, Math.max(this.threats.get(th.id) ?? 0, time + 600));
    this.threatList.frame((x, y) => {
      const c = this.cameras.main;
      return { x: ((x * PX - c.worldView.x) * c.zoom) / DPR, y: ((y * PX - c.worldView.y) * c.zoom) / DPR };
    }, me ? { x: me.x, y: me.y } : null, TILE_METERS);
    // Whoever struck you lately: a red pulsing mark over them.
    for (const [id, until] of this.threats) {
      const v = this.views.get(id);
      if (!v || until < time) { this.threats.delete(id); continue; }
      const y = v.y - v.top * 0.5 - 18 + Math.sin(time / 120) * 1.5;
      t.fillStyle(0xd9573b, 0.95).fillTriangle(v.x - 5, y - 6, v.x + 5, y - 6, v.x, y + 2);
      t.lineStyle(1.5, 0xd9573b, 0.5 + Math.sin(time / 90) * 0.3).strokeCircle(v.x, v.y - v.top * 0.25, Math.max(10, v.half + 6));
    }
    // The controller's cursor: a ring with a cross, gold on a target.
    const rg = this.reticle.clear();
    if (pad.mode === "pad" && this.cursor && me) {
      const cx = this.cursor.x * PX, cy = this.cursor.y * PX, on = !!this.cursorOn, R = on ? 11 : 8;
      rg.lineStyle(3.5, 0xfbf6ea, 0.9).strokeCircle(cx, cy, R);
      rg.lineStyle(2, on ? 0xe9b949 : 0x2f8aa8, 1).strokeCircle(cx, cy, R);
      for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) rg.lineBetween(cx + ax * (R - 3), cy + ay * (R - 3), cx + ax * (R + 5), cy + ay * (R + 5));
    }
    this.fx.frame(performance.now());
    if (me && time - this.lastPrompt > 200) { this.lastPrompt = time; this.promptAt(me); }
    else if (!me) this.hud.prompt("", "");
  }

  /** True if a person's gear has them in the air: riding something with air speed (a PLANE, a DRAGON). */
  private airborne(gear: string): boolean {
    if (!gear) return false;
    let air = this.airCache.get(gear);
    if (air === undefined) {
      const ride = this.slotOf(gear, "ride");
      air = false;
      if (ride) try { air = parsePhrase(dictionary, ride).stats.num("speed_air") > 0; } catch { /* not a word */ }
      this.airCache.set(gear, air);
    }
    return air;
  }

  /** The fog past your sight: one canvas, clear in the middle, paper-grey beyond; scaled to fit. */
  private makeFog(): Phaser.GameObjects.Image {
    const tex = this.textures.createCanvas("fog", FOG_SIZE, FOG_SIZE)!;
    const ctx = tex.context, c = FOG_SIZE / 2;
    const grad = ctx.createRadialGradient(c, c, FOG_CLEAR * 0.92, c, c, FOG_CLEAR * 1.18);
    grad.addColorStop(0, "rgba(226, 216, 196, 0)");
    grad.addColorStop(1, "rgba(226, 216, 196, 0.62)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, FOG_SIZE, FOG_SIZE);
    tex.refresh();
    return this.add.image(0, 0, "fog").setScrollFactor(0).setDepth(11500);
  }

  /**
   * What you can do where you stand, over the letter bar: dig a cache, gather at the temple,
   * trade at a market, claim something nobody owns that is too big to carry.
   */
  private promptAt(me: { x: number; y: number }) {
    let best: { d: number; key: string; text: string } | null = null;
    const offer = (d: number, key: string, text: string) => { if (!best || d < best.d) best = { d, key, text }; };
    this.net.state.things.forEach((t: any) => {
      const d = Math.hypot(t.x - me.x, t.y - me.y);
      if (d > SITE_RADIUS + 0.5) return;
      const name = String(t.phrase).toUpperCase();
      if (t.fixture === "cache") offer(d, "G", "dig the buried cache: X and a prize");
      else if (t.fixture === "temple") offer(d, "G", "pray at the TEMPLE for Q");
      else if (t.fixture === "market") offer(d, "T", "trade at the MARKET, hire a worker");
      else if (!t.owner && d <= 2) {
        const set = dictionary.word(lookOf(dictionary, t.phrase).noun)?.set;
        if (set && !set.tile_type) offer(d, "E", set.portable === false ? `claim ${name}: it becomes yours` : `pick up ${name}`);
      }
    });
    const b = best as { key: string; text: string } | null;
    this.hud.prompt(b?.key ?? "", b?.text ?? "");
  }

  /** Right-click: the inspect card for whoever or whatever is under the pointer; nothing there closes it. */
  private inspectAt(x: number, y: number, p: Phaser.Input.Pointer) {
    const id = this.hitAt(x, y, true);
    if (!id) {
      this.hud.closeInspect();
      // Inside an area (claimed ground, a FIRE): its card, what it does and whose it is.
      const zone = this.zoneView.tagAt(x * PX, y * PX, true) ?? this.zoneView.tagAt(x * PX, y * PX);
      if (zone) this.chips.show(zone);
      return;
    }
    this.inspectId(id, p.x / DPR, p.y / DPR);
  }

  /** The inspect card for a player, creature or thing, by id, beside a point on screen. */
  private inspectId(id: string, sx: number, sy: number) {
    const state = this.net.state, mine = this.net.sessionId;
    const nameOf = (owner: string) => (owner === mine ? "you" : String(state.players.get(owner)?.name ?? "someone"));
    const read = (phrase: string, count: number): Card => {
      try {
        const card = cardOf(dictionary, parsePhrase(dictionary, phrase));
        card.title = counted(phrase, count);
        return card;
      } catch {
        return { title: counted(phrase, count), kind: "", stats: [], does: [], letters: "" };
      }
    };
    const thing = state.things.get(id), who = state.players.get(id);
    let card: Card, extra: string[], name: string;
    if (thing) {
      name = String(thing.phrase);
      card = read(name, thing.count);
      extra = [thing.owner ? `belongs to ${nameOf(thing.owner)}` : "belongs to nobody", `condition ${Math.round(thing.hp)}%`];
      const how: Record<string, string> = {
        cache: "a buried cache: stand by it and press G to dig. Each dig gives an X; the last turns up a prize of letters",
        temple: "the map's one temple: press G beside it for Q, which comes back slowly",
        market: "a market: T to trade (three of a letter for one you want, and a T for every trade) or hire a worker",
        ruin: thing.owner ? "a ruin: it makes R for its owner; break it for D and X" : "a ruin nobody owns: E beside it to claim it (it makes R for you), or break it for D and X",
      };
      if (how[thing.fixture]) extra.unshift(how[thing.fixture]!);
      else if (!thing.owner) extra.unshift("nobody's: E beside it to take it, or to claim it if it is too big to carry");
    } else if (who.owner) {
      name = String(who.name);
      card = read(name, who.count);
      extra = [who.owner === "-" ? "wild" : `belongs to ${nameOf(who.owner)}`, `health ${Math.round(who.hp)}%`];
    } else {
      // A person: a human body with whatever was put on them, carrying their gear.
      name = String(who.name);
      const traits = String(who.traits ?? "");
      card = read(traits ? `${traits} human` : "human", 1);
      card.title = id === mine ? `${name.toUpperCase()} (you)` : name.toUpperCase();
      card.kind = traits ? `person · ${traits}` : "person";
      card.does = who.gear ? [`carries ${String(who.gear).toUpperCase()}`] : ["carries nothing"];
      extra = [`health ${Math.round(who.hp)}%`];
    }
    this.hud.inspect(card, extra, { id, name } satisfies Aimed, sx, sy);
  }

  // -------------------------------------------------------------------------------------------
  // Controller (pad.ts calls `padFrame` each frame no screen is open)

  /** A map point (tiles) on screen, in CSS pixels. */
  private toScreen(x: number, y: number) {
    const cam = this.cameras.main;
    return { x: ((x * PX - cam.worldView.x) * cam.zoom) / DPR, y: ((y * PX - cam.worldView.y) * cam.zoom) / DPR };
  }

  /**
   * What the controller can point at, nearest you first, within sight: `describe` anything
   * including you; `someone` anyone or anything but you; `foe` what a click would attack (other
   * people, creatures not yours, things someone else owns); `any` everything, you last.
   */
  private targets(kind: "any" | "describe" | "someone" | "foe"): { id: string; x: number; y: number; d: number }[] {
    const state = this.net.state, mine = this.net.sessionId, me = state.players.get(mine);
    if (!me) return [];
    const out: { id: string; x: number; y: number; d: number }[] = [];
    const reach = this.sightTiles + 1;
    state.things.forEach((t: any, id: string) => {
      if (kind === "foe" && (!t.owner || t.owner === mine || dictionary.word(lookOf(dictionary, t.phrase).noun)?.set.tile_type)) return;
      const d = Math.hypot(t.x - me.x, t.y - me.y);
      if (d <= reach) out.push({ id, x: t.x, y: t.y, d });
    });
    state.players.forEach((o: any, id: string) => {
      if (id === mine) { if (kind === "describe" || kind === "any") out.push({ id, x: o.x, y: o.y, d: kind === "any" ? 1e6 : 0.5 }); return; }
      if (kind === "foe" && o.owner === mine) return;
      const d = Math.hypot(o.x - me.x, o.y - me.y);
      if (d <= reach) out.push({ id, x: o.x, y: o.y, d });
    });
    return out.sort((a, b) => a.d - b.d);
  }

  /** Puts the controller's cursor on a target (or a spot, with no target). */
  private snap(id: string | null, at: { x: number; y: number } | null) {
    this.cursorOn = id;
    this.cursor = at ? { x: at.x, y: at.y } : null;
    this.cursorMoved = performance.now();
  }

  /** The next target after the cursor's (LB back, RB on), in nearest-first order. */
  private cycle(list: { id: string; x: number; y: number }[], by: number) {
    if (!list.length) return null;
    const i = list.findIndex((t) => t.id === this.cursorOn);
    return list[(((i < 0 ? (by > 0 ? -1 : 0) : i) + by) % list.length + list.length) % list.length]!;
  }

  /**
   * One controller frame with no screen open. Left stick walks (in `update`). The right stick
   * moves a cursor that snaps to whatever is nearest it. Then by state:
   * - aiming (adjectives or an event): LB/RB next target, A casts on it (or at the spot), B puts
   *   it away, D-pad up opens your gear;
   * - inspecting (LT): LB/RB or the stick change what the card is about, A adds an adjective,
   *   X offers a trade, B or LT closes;
   * - otherwise the buttons press the keys they stand for (A gather, X take, B get off, LB drop,
   *   RB use, Y spell, Start menu, D-pad screens), RT attacks and LT inspects.
   */
  private padFrame(p: Pad, dt: number) {
    if (!this.net || !this.map) return;
    const state = this.net.state, me = state.players.get(this.net.sessionId), now = performance.now();
    if (p.pressed("start")) p.key("Escape");
    if (p.pressed("up")) p.key("l");
    if (p.pressed("down") || p.pressed("back")) p.key("i");
    if (p.pressed("right")) p.key("t");
    if (p.pressed("left") && !this.hud.focusOffers()) this.hud.toast("No offers", "bad");
    if (!me) return;
    const kind = this.aiming ? (this.aimHow === "describe" ? "describe" : this.aimHow === "someone" ? "someone" : "any") : this.padInspect ? "any" : "foe";
    // The right stick: move the cursor from where it is (or from you), snapping to what is near.
    const rs = p.stick(1);
    if (rs.m > 0) {
      const from = this.cursor ?? { x: me.x, y: me.y }, speed = 9 * dt;
      let x = from.x + rs.x * speed, y = from.y + rs.y * speed;
      const off = Math.hypot(x - me.x, y - me.y), max = this.sightTiles;
      if (off > max) { x = me.x + ((x - me.x) / off) * max; y = me.y + ((y - me.y) / off) * max; }
      let near: string | null = null, best = 1.1;
      for (const t of this.targets(this.padInspect ? "any" : kind === "foe" ? "any" : kind)) {
        const d = Math.hypot(t.x - x, t.y - y);
        if (d < best) { best = d; near = t.id; }
      }
      this.cursor = { x, y };
      this.cursorOn = near;
      this.cursorMoved = now;
      if (this.padInspect && near && near !== this.hud.inspecting) this.padInspectAt(near);
    } else if (this.cursorOn) {
      // On a target: follow it.
      const t = state.players.get(this.cursorOn) ?? state.things.get(this.cursorOn);
      if (t) this.cursor = { x: t.x, y: t.y }; else this.cursorOn = null;
    }
    if (this.aiming) {
      if (p.pressed("lb") || p.pressed("rb")) { const t = this.cycle(this.targets(kind), p.pressed("rb") ? 1 : -1); if (t) this.snap(t.id, t); }
      if (this.cursor) { const s = this.toScreen(this.cursor.x, this.cursor.y); this.hud.pointer(s.x, s.y); }
      if (p.pressed("a") && this.cursor) {
        const target = this.cursorOn && (this.aimHow !== "someone" || this.cursorOn !== this.net.sessionId) ? this.cursorOn : null;
        if (!target && this.aimHow === "describe") return this.hud.toast("Move the cursor onto a thing, a creature, a person or you", "bad");
        if (!target && this.aimHow === "someone") return this.hud.toast("Move the cursor onto a person, a creature or a thing", "bad");
        this.release(this.aiming, this.aimHow, target ?? { ...this.cursor });
        this.cursor = null; this.cursorOn = null;
      } else if (p.pressed("b")) { this.endAim(true); this.cursor = null; this.cursorOn = null; }
      return;
    }
    if (this.padInspect) {
      if (!this.hud.inspectOpen) { this.padInspect = false; return; }
      if (p.pressed("lb") || p.pressed("rb")) { const t = this.cycle(this.targets("any"), p.pressed("rb") ? 1 : -1); if (t) { this.snap(t.id, t); this.padInspectAt(t.id); } }
      if (p.pressed("a")) { const b = document.querySelector<HTMLElement>("#inspect [data-adjective]"); if (b) p.click(b); this.padInspect = false; }
      else if (p.pressed("x")) { const b = document.querySelector<HTMLElement>("#inspect [data-trade-with]"); if (b) { p.click(b); this.padInspect = false; } }
      else if (p.pressed("b") || p.pressed("lt")) { this.hud.closeInspect(); this.padInspect = false; this.cursor = null; this.cursorOn = null; }
      return;
    }
    // The cursor fades a while after the stick lets go.
    if (this.cursor && now - this.cursorMoved > 3000) { this.cursor = null; this.cursorOn = null; }
    if (p.pressed("lt")) {
      const list = this.targets("any");
      const t = (this.cursorOn && list.find((x) => x.id === this.cursorOn)) || list[0];
      if (t) { this.snap(t.id, t); this.padInspect = true; this.padInspectAt(t.id); }
    }
    if (p.pressed("rt")) {
      const foes = this.targets("foe");
      const t = (this.cursorOn && foes.find((x) => x.id === this.cursorOn)) || foes[0];
      if (t) { this.claiming = null; this.foe = t.id; this.net.attack(t.id); this.snap(t.id, t); }
      else { this.foe = null; this.net.attack(null); this.hud.toast("Nothing to attack in sight", "bad"); }
    }
    const keys: [Parameters<Pad["pressed"]>[0], string][] = [["a", "g"], ["x", "e"], ["b", "r"], ["lb", "q"], ["rb", "u"], ["y", "Enter"]];
    for (const [b, k] of keys) if (p.pressed(b)) p.key(k);
  }

  /** LT's inspect card for a target, beside it on screen. */
  private padInspectAt(id: string) {
    const t = this.net.state.players.get(id) ?? this.net.state.things.get(id);
    if (!t) return;
    const s = this.toScreen(t.x, t.y);
    this.inspectId(id, s.x + 20, s.y - 40);
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
        flashUntil: 0, shakeUntil: 0, barUntil: 0, crit: false, lungeUntil: 0, lungeTo: null,
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
    // Struck: a shake; striking: a lunge toward the target and back.
    let ox = 0, oy = 0;
    if (v.shakeUntil > time) { const k = (v.shakeUntil - time) / 260; ox += Math.sin(time * 0.09) * 2.6 * k * (v.crit ? 1.8 : 1); }
    if (v.lungeUntil > time && v.lungeTo) {
      const k = Math.sin(((v.lungeUntil - time) / 220) * Math.PI), dx = v.lungeTo.x - v.x, dy = v.lungeTo.y - v.y, d = Math.hypot(dx, dy) || 1;
      ox += (dx / d) * 5 * k; oy += (dy / d) * 5 * k;
      if (Math.abs(dx) > 0.5) v.facing = dx > 0 ? 1 : -1;
    }
    v.body.setPosition(v.x + ox, v.y + bob + oy).setDepth(100 + v.y + (v.flies ? 40 : 0)).setFlipX(v.facing < 0);
    v.body.setRotation(v.living ? Math.sin(t * 1.6 + v.phase) * 0.03 + (v.moving > 0 ? Math.sin(t * 12 + v.phase) * 0.05 : 0) : 0);
    v.flames.forEach((f, i) => {
      const [fx, fy] = v.spots[i]!;
      f.setPosition(v.x + fx * 0.5 * v.facing, v.y + bob + fy * 0.5).setDepth(v.body.depth + 0.5);
      const flick = 1 + Math.sin(t * 9 + i * 2.1 + v.phase) * 0.14, base = f.getData("s") as number;
      f.setScale(base * (0.92 + Math.sin(t * 6 + i) * 0.08), base * flick);
      f.setRotation(Math.sin(t * 4 + i * 1.7) * 0.12);
    });
    // A blow flashes it white, then red.
    if (v.flashUntil > time) v.body.setTint((v.flashUntil - time) > 90 ? 0xffffff : 0xff4a3a).setTintMode(Phaser.TintModes.FILL);
    else if (v.body.tintMode !== Phaser.TintModes.MULTIPLY) v.body.setTintMode(Phaser.TintModes.MULTIPLY);
    const fade = v.barUntil > time && v.barUntil - time < 1000 ? (v.barUntil - time) / 1000 : 1;
    v.bar.setAlpha(fade); v.barBack.setAlpha(fade);
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
    const inspected = this.hud.inspecting;
    const ringed = id === this.foe || id === inspected || id === this.hover;
    if (ringed) {
      if (!v.ring) { v.ring = this.add.image(0, 0, "__WHITE"); useMade(v.ring, this.paint.ring(Math.max(10, Math.min(40, v.half + 6))), DPR); }
      v.ring.setPosition(v.x, v.y).setDepth(v.body.depth - 0.5).setTint(id === this.hover ? 0xe9b949 : id === inspected ? 0x2f8aa8 : 0xd9573b).setAlpha(0.75 + Math.sin(t * 6) * 0.25);
    } else if (v.ring) { v.ring.destroy(); v.ring = undefined; }
  }

  private drop(id: string, v: View) {
    v.body.destroy(); v.tag.destroy(); v.bar.destroy(); v.barBack.destroy(); v.ring?.destroy();
    v.flames.forEach((f) => f.destroy()); v.badges.forEach((b) => b.destroy());
    this.views.delete(id);
  }

  /** Tags that would overlap slide down under each other, nearest the top first. */
  private unstackTags() {
    const tags = [...this.zoneView.tags(), ...[...this.views.values()].map((v) => v.tag)].sort((a, b) => a.y - b.y);
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
    // A thing with no slot of its own (a STONE) is carried in the hand.
    if (slot === "held") {
      for (const g of gear.split(",").map((s) => s.trim()).filter(Boolean)) {
        const def = dictionary.word(lookOf(dictionary, g).noun);
        if (def?.role === "noun" && (def.set.equip_slot ?? "none") === "none" && def.set.mountable !== true) return g;
      }
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
        stampTerrain(this.map, { x: e.x, y: e.y, radius: e.radius, tile: e.tile, soil: e.soil, x2: e.x2, y2: e.y2 });
        stamps.push(e);
      }
      this.sendMap();
      for (const e of stamps) this.redrawAround(e.x, e.y, e.radius);
    }
    this.updateChunks();

    const me0 = state.players.get(mine);
    const overMap = this.zoneView.update(state.zones, time, mine, me0 ? { x: me0.x * PX, y: me0.y * PX } : undefined, (id: string) => String(state.players.get(id)?.name ?? ""));
    // A claim on its way: once close enough, take it.
    if (this.claiming) {
      const t = state.things.get(this.claiming);
      if (!t || !me0 || t.owner) this.claiming = null;
      else if (Math.hypot(t.x - me0.x, t.y - me0.y) <= 1.8) { this.net.take(this.claiming); this.net.stop(); this.claiming = null; }
    }

    const k = Math.min(1, delta / 100);
    state.things.forEach((t: any, id: string) => {
      live.add(id);
      const v = this.view(id);
      const look = lookOf(dictionary, t.phrase, t.count);
      this.dress(v, look, undefined, []);
      this.label(v, [counted(t.phrase, t.count)], t.owner === mine ? TAG_INK.mine : t.owner ? TAG_INK.theirs : TAG_INK.wild);
      v.x = t.x * PX; v.y = t.y * PX;
      this.place(v, id, time, t.hp, t.hp < 100 && v.barUntil > time);
    });
    state.players.forEach((p: any, id: string) => {
      live.add(id);
      const v = this.view(id);
      const creature = p.owner !== "";
      const statuses: string[] = p.status ? p.status.split(" ").filter(Boolean) : [];
      if (creature) {
        // A roaming boss stands half again as tall, with a red tag saying what it drops.
        const look = lookOf(dictionary, p.name, p.count);
        this.dress(v, p.boss ? { ...look, scale: look.scale * 1.6 } : look, undefined, statuses);
        this.label(v, p.boss ? [`${counted(p.name, p.count)} · BOSS`, "slay it for Z Z Z"] : [counted(p.name, p.count)],
          p.boss ? TAG_INK.person : p.owner === mine ? TAG_INK.mine : p.owner === "-" ? TAG_INK.wild : TAG_INK.theirs);
      } else {
        const colour = id === mine ? "#3f6fa8" : PEOPLE[[...String(p.name)].reduce((n, c) => n + c.charCodeAt(0), 0) % PEOPLE.length]!;
        // Adjectives someone put on a person (WORST, HUGE) change their look like any other body's.
        const traits = String(p.traits ?? "");
        const look = lookOf(dictionary, traits ? `${traits} human` : "human");
        this.dress(v, { ...look, colour: look.colour === lookOf(dictionary, "human").colour ? colour : look.colour }, this.slotOf(p.gear, "held"), statuses, this.slotOf(p.gear, "ride"));
        const name = traits ? `${String(p.name).toUpperCase()} · ${traits.toUpperCase()}` : String(p.name).toUpperCase();
        this.label(v, p.gear ? [name, `+ ${p.gear}`] : [name], id === mine ? TAG_INK.me : TAG_INK.person);
      }
      // Ease toward the server's position so ten updates a second look smooth.
      const tx = p.x * PX, ty = p.y * PX;
      if (Number.isNaN(v.x)) { v.x = tx; v.y = ty; }
      const dx = tx - v.x, dy = ty - v.y;
      if (Math.abs(dx) > 0.15) v.facing = dx > 0 ? 1 : -1;
      v.moving = Math.hypot(dx, dy) > 0.3 ? 0.3 : Math.max(0, v.moving - delta / 1000);
      v.x += dx * k; v.y += dy * k;
      this.place(v, id, time, p.hp, id === mine || (p.hp < 100 && v.barUntil > time));
      if (id === mine || (id === this.watching && !state.players.get(mine))) this.cameras.main.centerOn(v.x, v.y);
    });
    for (const [id, v] of this.views) if (!live.has(id)) this.drop(id, v);
    this.unstackTags();
    this.overlays(time, delta);

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
      this.hud.lock(); // dead or spectating: no spelling
      if (this.over) {
        this.hud.hud({ name: this.myName, hp: 0, alive: state.alive, clock: state.clock ?? 0 }); // the round goes on
        this.hud.knockedOut(this.watching ? String(state.players.get(this.watching)?.name ?? "") || null : null);
      }
      return;
    }
    const keys = this.keys, typing = this.hud.typing;
    // Opening or closing the spell window (or any key it swallowed) must not leave an arrow held down.
    if (typing !== this.wasTyping) { this.input.keyboard?.resetKeys(); this.wasTyping = typing; }
    let dx = typing ? 0 : Number(keys.right.isDown || keys.d.isDown) - Number(keys.left.isDown || keys.a.isDown);
    let dy = typing ? 0 : Number(keys.down.isDown || keys.s.isDown) - Number(keys.up.isDown || keys.w.isDown);
    // The left stick walks the same way, in any direction.
    if (!dx && !dy && !typing && (pad.walk.x || pad.walk.y)) { const m = Math.hypot(pad.walk.x, pad.walk.y); dx = pad.walk.x / m; dy = pad.walk.y / m; }
    if (dx || dy) {
      if (time - this.lastSteer > 100) { this.net.move(me.x + dx * 3, me.y + dy * 3); this.lastSteer = time; }
      this.gathering = null;
      this.steering = true;
    } else if (this.steering) {
      this.net.stop(); // stop where the server has us, not where our older copy says
      this.steering = false;
    }
    let others = 0;
    state.players.forEach((p: any, id: string) => { if (id !== mine && p.owner === "") others++; });
    this.myName = String(me.name);
    this.hud.hud({ name: this.myName, hp: me.hp, alive: state.alive || others + 1, clock: state.clock ?? 0 });
    let city = "";
    state.cities?.forEach((c: any) => {
      if (Math.hypot(c.x - me.x, c.y - me.y) <= c.radius + 1) city = `${c.ruler ? `ruled by ${c.ruler}` : "nobody rules it"} · ${c.citizens} citizen${c.citizens === 1 ? "" : "s"}`;
    });
    this.hud.corner(Tile[tileAt(this.map, me.x, me.y)] ?? "", Math.floor(me.x), Math.floor(me.y), state.wind ?? 0, city);
    this.hud.where(
      `${Tile[tileAt(this.map, me.x, me.y)]} · ${Math.round(me.x * TILE_METERS)}, ${Math.round(me.y * TILE_METERS)} m · ` +
      `${others} other${others === 1 ? "" : "s"} in sight${state.daylight === "night" ? " · night" : ""}${state.weather ? ` · ${state.weather}` : ""}`,
    );
    // While aiming, ring whatever the pointer is over.
    if (pad.mode === "pad") this.hover = this.cursor ? this.cursorOn : null;
    else if (this.aiming) {
      const p = this.input.activePointer, at = this.cameras.main.getWorldPoint(p.x, p.y);
      this.hover = this.hitAt(at.x / PX, at.y / PX, this.aimHow === "describe");
    } else this.hover = null;
    this.chips.update(Events.at(state, me.x, me.y), state.clock ?? 0);
    this.minimap.draw(this.map, me, this.editsApplied, time);
  }
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#4d7b8c",
  width: window.innerWidth * DPR,
  height: window.innerHeight * DPR,
  scale: { mode: Phaser.Scale.NONE, zoom: 1 / DPR },
  // One texture per batch: with more, Phaser 4.2 sometimes draws a standee with another texture's
  // pixels (seen in headless Chrome once canvas textures are made mid-game). ?units=N overrides.
  render: { antialias: true, roundPixels: false, maxTextures: Number(new URLSearchParams(location.search).get("units")) || 1 },
  scene: World,
});
window.addEventListener("resize", () => game.scale.resize(window.innerWidth * DPR, window.innerHeight * DPR));
