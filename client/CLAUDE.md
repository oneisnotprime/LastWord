# client

Phaser 4 and Vite. Draws what the server says and sends the player's intents.

- Test: `npm test -w client`. Typecheck: `npm run typecheck -w client`.
- Run: `npm run dev:client`. Build: `npm run build -w client`.
- Check visible changes in a real browser with headless Playwright before calling them done.
- No game rules here. If the client needs to know an outcome, it asks `shared/` or the server.
- Desktop only: keyboard and mouse, or a controller. Do not add touch input or phone layouts.

## Map

- `styles.html` + `src/styles/` art style prototypes (keys 1-5, N for night); not used by the game.
- `src/main.ts` the Phaser scene: draws the map from the seed, markers for players and things,
  camera, movement input.
- `src/start.ts` the start screen shown before joining (Play with bots, or join friends); `net.ts` calls it.
- `src/net.ts` connection to the server: port 2567 under Vite (ports 5173 and 4173), else the
  page's own origin, since a deployed server serves the page. `VITE_SERVER` overrides both.
- `src/hud.ts` the HTML overlay: the top-left HUD card (health, armour and ride bars, hands,
  wears, rides, creatures, status chips, stores; players alive and round time), letter tiles at
  the bottom middle, the spell window (Enter opens it; while open every key goes to it, Enter
  casts, Esc cancels), the aiming banner, toasts, and the inventory screen (I or L: letters, gear,
  creatures, your numbers), drawn from the server's private `loadout` message. Location is on it.
- The spell window lists the words you can spell now (shared `spellableNow`) as tabs by group
  (weapons, gear, rides, creatures, buildings, other, verbs, events, areas, sky); a tab opens its
  words, a click puts one in the box.
- Adjectives spelled alone (`readDescription`) and events that need a target (shared `aimOf`) put
  `main.ts` into aiming: a click on a thing, creature, person or yourself sends `describe`, or
  `pick` + `spell` + `pick(null)` for an event; Esc or right-click cancels.
- Right-click is only inspect: `inspectAt` shows the inspect card (shared `cardOf`) with Add
  adjective, which opens the spell window aimed at that target. `Hud.lock` stops spelling once
  you are dead, spectating or the round is over. Bottom left (`#corner`): ground and tile.
- Messages are terse (`terse` in `main.ts`): routine success is not toasted. The top-left HUD
  shows only rows you have; knocked out, it says KNOCKED OUT and whom the camera follows.
- Esc closes what is open (screen, aim, inspect), else opens the menu (`#menu`) with the controls.
- The spell window is only the input: a letter you do not hold (counting copies; for
  `give name abc` only the given letters) is not added, and the window shakes red.
- Letter tiles: one per copy, or one with a count above `COPIES_SHOWN` (4).
- `src/events.ts` event chips at the top middle (`#events`): weather, night and zones you stand in,
  with time left; a click opens `#eventcard` (shared `eventCard`: what it changes, who, what ends it).
- `src/minimap.ts` the minimap, only while the loadout lists `senses` (a MAP) or `eyes` (a CAMERA
  of yours on the ground: its ground is revealed and ringed); `sensed` fills it.
- Opening or closing the spell window, and window blur, reset Phaser's keys: a key released
  while the window had focus was never seen, and the player walked on or stopped answering.
- `burst` draws the `described` effect: a gold burst and a rising tag listing what changed.
- `window.__lw` exposes the connection and map for browser checks.
- To check in a browser: start the server (`npm start -w server`), build and
  `npx vite preview` in `client/`, then drive it with Playwright.
- Art is Paper Diorama (style 4 of the prototypes), all drawn by code on canvases:
  - `src/art/terrain.ts` the map as torn paper sheets with cut-outs, in 16-tile chunks drawn by
    `terrain.worker.ts`; a terrain edit redraws only the chunks it touches.
  - `src/art/shapes.ts` what words look like: `WORDS` (a shape for one word) wins over
    `ARCHETYPES` (one per archetype) and `CLASSES`. Builders and units are in `build.ts`. Add a
    word's own shape there; `gallery.html` shows every shape (`?phrases=huge wolf,red car`).
  - `src/art/raster.ts` generated word images (`public/art/words/*.webp`, `manifest.json`, made
    by `tools/art`, `docs/ART_PIPELINE.md`): the manifest loads when the scene starts, an image
    when its word is first drawn; until then the drawn shape stands in. An image wins over
    `WORDS`; `paper.ts` `drawRaster` gives it the paper border and shadow, and the drawn shape
    still sets its size, stand and thread. Gallery: `?gen=all`, `?compare=1`.
  - `src/art/look.ts` phrase to look: colour from colour or material, size from mass, burning,
    frozen, invisible, hidden, count. `standee.ts` renders one; `paper.ts` cut-outs, tags, badges.
  - `src/paint.ts` caches canvases as textures; `src/zones.ts` areas as tissue paper with
    cut-outs; `src/sky.ts` night, weather and fields over the whole map.
  - Canvas textures are never resized or destroyed mid-game, and `maxTextures` is 1: Phaser 4.2
    otherwise drew some standees with another texture's pixels.
- `src/pad.ts` controller input (Gamepad API, standard mapping), polled each animation frame.
  The last input sets `body.pad` (controller prompts) or not; `body.ps` swaps Xbox labels for
  PlayStation ones. Write prompts with `keyGlyph("G")` (key and button, CSS shows one),
  `padGlyph("a")`, or `only(keys, controller)`; `KEY_BUTTON` maps keys to buttons.
  - Screens register a `Scope` (`pad.add`, lowest rank wins): D-pad or left stick move a focus
    ring (`.padfocus`) over buttons, items and inputs, A clicks, B sends Esc. Hud's scopes: the
    letter picker (`#picker` in the spell window: A add, B delete, X clear, RB space, Y cast),
    the field picker for an offer's letters (`#fieldpick`), the inventory and trade
    screens (focus on an item opens its card, `focusDetails`), and the offer cards (D-pad left).
    `pad.ts` adds the Esc menu, the start screen and any `[data-pad-scope]` element.
  - With no screen open, `World.padFrame` has the frame: left stick walks (`pad.walk`), the
    right stick moves a cursor that snaps to targets, RT attacks, LT inspects (LB/RB cycle), and
    aiming takes LB/RB, A, B. Other buttons press the keys they stand for (`pad.key`).
  - Browser checks stub `navigator.getGamepads` with a mutable pad object.
- `src/fx.ts` HTML effects: letter popups from `got` (a big tile with its reason tag; then each
  letter flies down to its own tile one after another, and only the tiles just added bounce and
  light up, briefly), damage numbers from `hits`, the red screen edge when you are hit,
  the red note when gathering finds nothing, and `note` ("+sight", from `sight`). In `main.ts`: `onHits` (flash, shake, lunge,
  tracer, health bar for a few seconds, a mark over whoever hit you), `overlays` (the camera zoomed
  so the screen holds your sight, fog past it, the gathering ring, `promptAt` hints over the
  letters: G: dig, E: claim).
- The spell window shows a compact preview (`#preview`: what it makes, two or three key effects)
  and the alphabet guide (shared `LETTER_GUIDE`), lighting letters you hold.
- Every item in the HUD and the inventory shows what it does (shared `heldText`; effects in
  force `effectText`) and a click opens its card (`Hud.inspectWord`).
- `src/threats.ts` arrows at the screen's edge for `threats` off screen (✈ air, ⚔ ground, distance);
  aircraft in view get a shadow and speed streaks (`airborne`).
- Areas' name tags say owner and kind and sit on the edge nearest you; a click on a tag, or a
  right-click inside an area, opens its card (`Zones.tagAt`, `Events.show`).
- A click on something nobody owns (a RUIN) walks there and claims it (`claiming`, `take` { id });
  Shift-click attacks it. A click anywhere on a person's or creature's standee (`onStandee`, its
  drawn bounds) locks on: red corner brackets, and the server chases and strikes until it dies, you
  walk or click elsewhere, or Esc (`unlock`). A gathering miss shows small (`missed`), a find's popup its `detail`.
- Knocked out, the HUD card has Start new round: `playAgain` (start.ts) reloads into a fresh room
  with the same choice, past the start screen. A room lost for good (server restart) does the same.
- Themes batch 1 art: `ARCHETYPES` has `herb` and `gem`; `WORDS` has the common professions (chef,
  nurse, judge, scout, mason...). Materials, cooked and rotten things take their colour from the
  data (`color`), through `look.ts`.
- Themes batch 2 art: `ARCHETYPES` has `amphibian`; `WORDS` has the core buildings, furniture,
  tools, machines and animals of batch 2, drawn with the existing builders (house, quad, bird,
  fish, bug, snake).
- The top-left HUD lists letters coming in a minute by letter and what makes them (loadout
  `income`), and food, fuel and power in and out; the inventory screen's Producing lines say why a
  producer is idle. The corner shows the wind and the city you stand in (ruler, citizens).
- The trade screen (T, `Hud.trade`): the market you stand at (pick the tiles you pay, `Hud.pay`,
  and the letter you get; the rack swap, once per market), hiring, transmuting into Z (only with
  alchemy: loadout `transmute`), and offers to people within TRADE_RANGE. Offers made
  and received are cards at the right (`#offers`: Accept, Counter, Decline, Withdraw). Inputs on a
  screen count as typing (`Hud.typing`), so their letters are not commands.
- A roaming boss (`Player.boss`) stands 1.6 times as tall with a red tag.
- `src/kits.ts` starting kits: the pick in three steps, job, building, letters (`#kits`, three
  choices each, keys 1-3 or a click, a countdown a step; `KitView.choosing` until your kit
  arrives, and meanwhile toasts (`Hud.quiet`) are dropped, not replayed). No legendary.
- Playtest batch C1: `src/recap.ts` (`RecapView`): the kill feed (`#killfeed`, from `killed`), the
  death recap (`#recap`, from `dead`) and the round recap (from `roundover`; the HUD says "round
  over", `Hud.ended`). `main.ts`: `onWindups` draws a red ring closing where a heavy blow lands and
  a "!" over the striker (`windups`), the screen edge pulses (`fx.warn`, `body.incoming`);
  `deathBeat` (a second of slow grey, camera drifting in); `Hud.closeScreens` on a blow or wind-up
  on you. `zones.ts`: a zone with `warn` gets a red ring closing until it strikes, then a flash;
  name tags stay with their zone (`ZONE_TAG_RISE`), never following you. The spell preview warns
  when a word strikes its speller too (shared `selfRisk`).
- `src/tips.ts` teaching tips (shared `tips.ts`): rotating word cards on the start screen (two
  columns: the word and kind, its properties with a short meaning each, `WordTip.lines`), one
  line (`#tip`) in the spell window while it is empty, and Word ideas with a reroll in the Esc
  menu, where Show tips turns them off (`lastword.tips` in localStorage).
- Themes batch 3: a body part is aimed like an event ("someone"; you can click yourself); threat
  arrows show a note (♪, `heard`) for someone only heard; `WORDS` has the core body parts,
  clothes, medicines, instruments, songs and feelings, drawn with the existing builders.
- Themes batch 4: the minimap shows static and JAMMED when `sensed.jammed`; terrain edits carry
  `only` (weather patches change only some tiles); faith is a fourth store on the HUD and the
  loadout; `WORDS` has the core money, crime, information, religion and weather words, drawn
  with the existing builders (rosette and sign icons for acts and events).
- Themes batch 5: `WORDS` has the core time, space, sea, sports and abstract words (rosettes and
  signs for acts and events, boats for vessels, bridges for docks, existing builders elsewhere).
- Fun batch C2: `#best` beside the letter tiles: the 3-5 best words the rack spells now (shared
  `bestWords`, for your situation from the loadout), a click opens the spell window with it
  (`Hud.drawBest`, redrawn on letters, loadout and health crossing 60%). The preview leads with
  the card's numbers (shared `leadStats`) then two things it does; the inspect card puts numbers
  before belongs-to and condition. `main.ts` `formation`: creatures within FAN_NEAR of a pile's
  first fan out round it (outside a rider's mount), and a pile of one kind and owner shows one tag
  ("WOLF ×5"); `unstackTags` hides a non-person tag (and its badges) that would slide more than
  MAX_SLIDE tags. A ridden mount is drawn at its own size and image (`standee.ts` `ride.scale`,
  `ride.raster`). `entrance`: `#bigcast` map-wide call (yours too, others' at most every CALL_GAP s),
  and in sight a camera shake and a full-size reveal. A click on a chest, the temple or a market
  walks there, then digs or opens the trade screen (`visiting`). Threat labels keep clear of the
  HUD card, chips, minimap, corner and letter bar (`threats.ts`). Body classes keep one sheet at a
  time: `onscreen` (a screen hides the HUD card, chips and calls; it closes your kit's card),
  `spelling` (calls wait), `bannered` (death or round end: screens and cards close).
